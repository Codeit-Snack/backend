import { Test, TestingModule } from '@nestjs/testing';
import {
  Prisma,
  PurchaseRequestStatus,
  purchase_orders_status,
} from '@prisma/client';
import { SellerOrderService } from './seller-order.service';
import { PrismaService } from '../../../database/prisma.service';
import { AuditLogService } from '../../../modules/audit/audit-log.service';
import { BudgetPeriodService } from '../../../modules/finance/services/budget-period.service';
import { BudgetReservationService } from '../../../modules/finance/services/budget-reservation.service';
import { ExpenseService } from '../../../modules/finance/services/expense.service';
import { ErrorCode } from '../../../common/enums/error-code.enum';

describe('SellerOrderService', () => {
  let service: SellerOrderService;
  let auditLog: { log: jest.Mock };
  let prisma: jest.Mocked<
    Pick<
      PrismaService,
      | 'purchase_orders'
      | 'purchase_request_items'
      | 'purchaseRequest'
      | '$transaction'
    >
  >;

  beforeEach(async () => {
    auditLog = { log: jest.fn().mockResolvedValue(undefined) };
    prisma = {
      purchase_orders: {
        findMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      } as unknown as PrismaService['purchase_orders'],
      purchase_request_items: {
        findMany: jest.fn(),
      } as unknown as PrismaService['purchase_request_items'],
      purchaseRequest: {
        findUnique: jest.fn(),
        update: jest.fn(),
      } as unknown as PrismaService['purchaseRequest'],
      $transaction: jest.fn(),
    } as unknown as typeof prisma;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SellerOrderService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: auditLog },
        {
          provide: BudgetPeriodService,
          useValue: {
            computeRemainingFunds: jest.fn().mockResolvedValue({
              remaining: new Prisma.Decimal('999999999'),
            }),
          },
        },
        { provide: ExpenseService, useValue: { create: jest.fn() } },
        {
          provide: BudgetReservationService,
          useValue: {
            ensureReservationForApprovedPurchaseOrder: jest
              .fn()
              .mockResolvedValue({
                reservationId: 77n,
                buyerOrganizationId: 2n,
                purchaseOrderId: 1n,
                reservedAmount: new Prisma.Decimal('15500'),
              }),
          },
        },
      ],
    }).compile();

    service = module.get(SellerOrderService);
  });

  describe('list', () => {
    it('returns paginated summaries', async () => {
      const row = {
        id: 1n,
        purchase_request_id: 5n,
        buyer_organization_id: 2n,
        status: purchase_orders_status.PENDING_SELLER_APPROVAL,
        items_amount: new Prisma.Decimal('15000'),
        created_at: new Date('2025-01-01T00:00:00.000Z'),
        purchase_requests: {
          id: 5n,
          status: PurchaseRequestStatus.OPEN,
        },
      };
      (prisma.purchase_orders.findMany as jest.Mock).mockResolvedValue([row]);
      (prisma.purchase_orders.count as jest.Mock).mockResolvedValue(1);

      const result = await service.list(10, {
        page: 1,
        limit: 10,
      });

      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        id: 1,
        purchaseRequestId: 5,
        buyerOrganizationId: 2,
        status: purchase_orders_status.PENDING_SELLER_APPROVAL,
        itemsAmount: '15000',
        purchaseRequestStatus: PurchaseRequestStatus.OPEN,
      });
      expect(prisma.purchase_orders.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { seller_organization_id: 10n },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('returns null when order missing', async () => {
      (prisma.purchase_orders.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.findOne(10, 999)).resolves.toBeNull();
    });
  });

  describe('approve', () => {
    it('approves pending order, syncs purchase request, audit log', async () => {
      const po = {
        id: 1n,
        purchase_request_id: 100n,
        buyer_organization_id: 2n,
        status: purchase_orders_status.PENDING_SELLER_APPROVAL,
      };
      const tx = {
        purchase_orders: {
          findFirst: jest.fn().mockResolvedValue(po),
          update: jest.fn().mockResolvedValue({}),
          findMany: jest
            .fn()
            .mockResolvedValue([{ status: purchase_orders_status.APPROVED }]),
        },
        purchase_order_decisions: {
          create: jest.fn().mockResolvedValue({}),
        },
        purchaseRequest: {
          findUnique: jest.fn().mockResolvedValue({
            id: 100n,
            status: PurchaseRequestStatus.OPEN,
          }),
          update: jest.fn().mockResolvedValue({}),
        },
      };
      (prisma.$transaction as jest.Mock).mockImplementation(
        async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
      );

      const findOneSpy = jest.spyOn(service, 'findOne').mockResolvedValue({
        id: 1,
        status: purchase_orders_status.APPROVED,
      } as Awaited<ReturnType<SellerOrderService['findOne']>>);

      const result = await service.approve(10, 99, 1, { shippingFee: '500' });

      findOneSpy.mockRestore();

      expect(tx.purchase_order_decisions.create).toHaveBeenCalled();
      expect(tx.purchase_orders.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: purchase_orders_status.APPROVED,
            shipping_fee: new Prisma.Decimal('500'),
          }),
        }),
      );
      expect(tx.purchaseRequest.update).toHaveBeenCalled();
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'BUDGET_RESERVATION_CREATE',
          organizationId: 2n,
        }),
      );
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'SELLER_ORDER_APPROVE',
        }),
      );
      expect(result).toMatchObject({
        id: 1,
        status: purchase_orders_status.APPROVED,
      });
    });
  });

  describe('updateShipping', () => {
    it('rejects when order not purchased', async () => {
      (prisma.$transaction as jest.Mock).mockImplementation(
        async (fn: (t: unknown) => Promise<unknown>) =>
          fn({
            purchase_orders: {
              findFirst: jest.fn().mockResolvedValue({
                id: 1n,
                status: purchase_orders_status.PENDING_SELLER_APPROVAL,
              }),
              update: jest.fn(),
            },
          }),
      );

      await expect(
        service.updateShipping(10, 99, 1, {
          shippingStatus: 'SHIPPED',
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.CONFLICT });
    });
  });
});
