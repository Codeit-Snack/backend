import { type Prisma, budget_reservations_status } from '@prisma/client';

/** 지정한 판매자 주문들에 걸린 ACTIVE 예산 예약을 RELEASED 로 돌립니다. */
export async function releaseActiveBudgetReservationsForPurchaseOrders(
  tx: Prisma.TransactionClient,
  purchaseOrderIds: bigint[],
): Promise<void> {
  if (purchaseOrderIds.length === 0) {
    return;
  }
  await tx.budget_reservations.updateMany({
    where: {
      purchase_order_id: { in: purchaseOrderIds },
      status: budget_reservations_status.ACTIVE,
    },
    data: {
      status: budget_reservations_status.RELEASED,
      released_at: new Date(),
    },
  });
}
