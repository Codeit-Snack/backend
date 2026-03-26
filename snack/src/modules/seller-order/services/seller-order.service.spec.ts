import { Test, TestingModule } from '@nestjs/testing';
import {
  OrgRole,
  Prisma,
  PurchaseRequestStatus,
  purchase_orders_status,
} from '@prisma/client';
import { SellerOrderService } from './seller-order.service';
import { PrismaService } from '../../../database/prisma.service';
import { AppException } from '../../../common/exceptions/app.exception';
import { ErrorCode } from '../../../common/enums/error-code.enum';
import type { JwtPayload } from '../../../common/types/jwt-payload.type';

function adminPayload(): JwtPayload {
  return {
    sub: '99',
    email: 'admin@seller.test',
    organizationId: '10',
    role: OrgRole.ADMIN,
    sessionId: 'sess-1',
  };
}

function memberPayload(): JwtPayload {
  return {
    sub: '100',
    email: 'member@seller.test',
    organizationId: '10',
    role: OrgRole.MEMBER,
    sessionId: 'sess-2',
  };
}

describe('SellerOrderService', () => {
  let service: SellerOrderService;
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
      ],
    }).compile();

    service = module.get(SellerOrderService);
  });

  describe('findAll', () => {
    it('returns paginated summaries', async () => {
      const row = {
        id: 1n,
        purchase_request_id: 5n,
        buyer_organization_id: 2n,
        status: purchase_orders_status.PENDING_SELLER_APPROVAL,
        items_amount: new Prisma.Decimal('15000'),
        created_at: new Date('2025-01-01T00:00:00.000Z'),
        _count: { purchase_order_items: 0 },
      };
      (prisma.purchase_orders.findMany as jest.Mock).mockResolvedValue([row]);
      (prisma.purchase_orders.count as jest.Mock).mockResolvedValue(1);

      const result = await service.findAll(10, {
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
        lineCount: 0,
      });
      expect(prisma.purchase_orders.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { seller_organization_id: 10n },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('throws when order missing', async () => {
      (prisma.purchase_orders.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.findOne(10, 999)).rejects.toThrow(AppException);
      await expect(service.findOne(10, 999)).rejects.toMatchObject({
        errorCode: ErrorCode.RESOURCE_NOT_FOUND,
      });
    });
  });

  describe('approve', () => {
    it('forbids non-admin roles', async () => {
      await expect(
        service.approve(10, 1, memberPayload(), {}),
      ).rejects.toMatchObject({ errorCode: ErrorCode.FORBIDDEN });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('runs transaction: creates items, approves, rolls up purchase request', async () => {
      const orderRow = {
        id: 1n,
        purchase_request_id: 100n,
        buyer_organization_id: 2n,
        seller_organization_id: 10n,
        status: purchase_orders_status.PENDING_SELLER_APPROVAL,
        platform: 'OTHER' as const,
        external_order_no: null,
        order_url: null,
        items_amount: new Prisma.Decimal('2000'),
        shipping_fee: new Prisma.Decimal('0'),
        approved_at: null,
        rejected_at: null,
        ordered_at: null,
        shipping_status: null,
        delivered_at: null,
        note: null,
        created_at: new Date(),
        updated_at: new Date(),
        purchased_by_user_id: null,
        purchase_requests: { status: PurchaseRequestStatus.OPEN },
        purchase_order_items: [],
      };

      const priLine = {
        id: 50n,
        purchase_request_id: 100n,
        seller_organization_id: 10n,
        product_id: 5n,
        product_name_snapshot: 'Test Snack',
        product_url_snapshot: null,
        unit_price_snapshot: new Prisma.Decimal('1000'),
        quantity: 2,
        line_total: new Prisma.Decimal('2000'),
        created_at: new Date(),
      };

      const buyerOrg = { id: 2n, name: 'Buyer Co' };

      const orderItemRow = {
        id: 77n,
        purchase_order_id: 1n,
        purchase_request_item_id: 50n,
        product_id: 5n,
        product_name_snapshot: 'Test Snack',
        product_url_snapshot: null,
        unit_price_snapshot: new Prisma.Decimal('1000'),
        quantity: 2,
        line_total: new Prisma.Decimal('2000'),
        created_at: new Date('2025-01-02T00:00:00.000Z'),
      };

      const detailRow = {
        ...orderRow,
        status: purchase_orders_status.APPROVED,
        approved_at: new Date('2025-01-02T00:00:00.000Z'),
        purchase_order_items: [orderItemRow],
        purchase_requests: { status: PurchaseRequestStatus.PARTIALLY_APPROVED },
        organizations_purchase_orders_buyer_organization_idToorganizations:
          buyerOrg,
        purchase_order_decisions: [],
      };

      const tx = {
        purchase_orders: {
          findFirst: jest
            .fn()
            .mockResolvedValueOnce(orderRow)
            .mockResolvedValueOnce(detailRow),
          update: jest.fn().mockResolvedValue({}),
          updateMany: jest.fn(),
        },
        purchase_request_items: {
          findMany: jest.fn().mockResolvedValue([priLine]),
        },
        purchase_order_items: {
          createMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        purchase_order_decisions: {
          create: jest.fn().mockResolvedValue({}),
        },
        purchaseRequest: {
          findUnique: jest.fn().mockResolvedValue({
            id: 100n,
            status: PurchaseRequestStatus.OPEN,
            purchase_orders: [
              { status: purchase_orders_status.PENDING_SELLER_APPROVAL },
              { status: purchase_orders_status.APPROVED },
            ],
          }),
          update: jest.fn().mockResolvedValue({}),
        },
      };

      (prisma.$transaction as jest.Mock).mockImplementation(
        async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
      );

      const result = await service.approve(10, 1, adminPayload(), {
        shippingFee: 500,
      });

      expect(tx.purchase_order_items.createMany).toHaveBeenCalled();
      expect(tx.purchase_orders.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: purchase_orders_status.APPROVED,
            shipping_fee: new Prisma.Decimal(500),
          }),
        }),
      );
      expect(tx.purchase_order_decisions.create).toHaveBeenCalled();
      expect(tx.purchaseRequest.update).toHaveBeenCalled();
      expect(result).toMatchObject({
        id: 1,
        status: purchase_orders_status.APPROVED,
        buyerOrganizationName: 'Buyer Co',
      });
    });
  });

  describe('updateShipping', () => {
    it('rejects when order not approved/purchased', async () => {
      (prisma.purchase_orders.findFirst as jest.Mock).mockResolvedValue({
        id: 1n,
        status: purchase_orders_status.PENDING_SELLER_APPROVAL,
        delivered_at: null,
      });

      await expect(
        service.updateShipping(10, 1, adminPayload(), {
          shippingStatus: 'SHIPPED',
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.CONFLICT });
    });
  });
});
