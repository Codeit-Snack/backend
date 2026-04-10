/**
 * 전체 API 상호작용 검증 (구매자·판매자 조직, 상품·카트·구매요청·판매자 주문).
 *
 * 실행 전:
 *   1) MySQL 기동 (예: docker compose up -d)
 *   2) npx prisma migrate deploy
 *   3) .env 또는 DATABASE_URL 등 JWT·DB 설정
 *   4) Redis가 없으면 초대 API는 실패할 수 있으나 본 플로우는 Redis 미사용
 *
 * PowerShell:
 *   $env:RUN_FLOW_E2E='1'
 *   npm run test:e2e -- flow.e2e-spec.ts
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createE2eApp } from './create-e2e-app';

const runFlow = process.env.RUN_FLOW_E2E === '1';

function okData<T>(res: request.Response, code?: number): T {
  if (code != null) {
    expect(res.status).toBe(code);
  } else if (![200, 201].includes(res.status)) {
    throw new Error(
      `Expected HTTP 200/201, got ${res.status}: ${JSON.stringify(res.body)}`,
    );
  }
  if (res.body?.success !== true) {
    throw new Error(`Expected success: true: ${JSON.stringify(res.body)}`);
  }
  return res.body.data as T;
}

(runFlow ? describe : describe.skip)(
  'API flow: buyer ↔ seller (e2e)',
  () => {
    let app: INestApplication;
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const buyerEmail = `buyer-${suffix}@flow.test`;
    const sellerEmail = `seller-${suffix}@flow.test`;
    const password = 'password12';

    let buyerToken: string;
    let sellerToken: string;
    let buyerOrgId: string;
    let sellerOrgId: string;
    let buyerUserId: string;
    let sellerUserId: string;
    let categoryId: number;
    let productId: number;
    let purchaseRequestId: number;
    let sellerOrderId: number;

    beforeAll(async () => {
      app = await createE2eApp();
    }, 120000);

    afterAll(async () => {
      if (app) {
        await app.close();
      }
    });

    it('01 signup: buyer org + seller org', async () => {
      const buyerRes = await request(app.getHttpServer())
        .post('/api/auth/signup')
        .send({
          email: buyerEmail,
          password,
          displayName: 'Buyer Admin',
          organizationName: `Buyer Co ${suffix}`,
        });
      const buyer = okData<{
        user: { id: string };
        organization: { id: string };
      }>(buyerRes);
      buyerOrgId = buyer.organization.id;
      buyerUserId = buyer.user.id;

      const sellerRes = await request(app.getHttpServer())
        .post('/api/auth/signup')
        .send({
          email: sellerEmail,
          password,
          displayName: 'Seller Admin',
          organizationName: `Seller Co ${suffix}`,
        });
      const seller = okData<{
        user: { id: string };
        organization: { id: string };
      }>(sellerRes);
      sellerOrgId = seller.organization.id;
      sellerUserId = seller.user.id;

      expect(buyerOrgId).not.toBe(sellerOrgId);
    });

    it('02 login: both users receive JWT scoped to their org', async () => {
      const b = okData<{ tokens: { accessToken: string } }>(
        await request(app.getHttpServer()).post('/api/auth/login').send({
          email: buyerEmail,
          password,
        }),
      );
      buyerToken = b.tokens.accessToken;

      const s = okData<{ tokens: { accessToken: string } }>(
        await request(app.getHttpServer()).post('/api/auth/login').send({
          email: sellerEmail,
          password,
        }),
      );
      sellerToken = s.tokens.accessToken;

      expect(buyerToken).toBeTruthy();
      expect(sellerToken).toBeTruthy();
    });

    it('03 seller: create global category (no JWT on categories API)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/categories')
        .send({ name: `Flow Cat ${suffix}`, sortOrder: 0, isActive: true });
      const cat = okData<{ id: number }>(res);
      categoryId = cat.id;
    });

    it('04 seller: create product in seller org', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/products')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          categoryId,
          name: `Flow Snack ${suffix}`,
          price: 1200,
          isActive: true,
        });
      const p = okData<{ id: number; organizationId: number }>(res);
      productId = p.id;
      expect(String(p.organizationId)).toBe(sellerOrgId);
    });

    it('05 buyer: add seller product to cart (cross-org product id)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ productId, quantity: 2 });
      const cart = okData<{ items: { productId: number; quantity: number }[] }>(
        res,
      );
      expect(cart.items.some((i) => i.productId === productId)).toBe(true);
      const line = cart.items.find((i) => i.productId === productId);
      expect(line?.quantity).toBe(2);
    });

    it('06 buyer: purchase request from cart creates seller purchase_order', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/purchase-requests')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ requestMessage: '플로우 테스트 요청' });
      const pr = okData<{
        id: number;
        status: string;
        items: { sellerOrganizationId: number }[];
      }>(res);
      purchaseRequestId = pr.id;
      expect(pr.status).toBe('OPEN');
      expect(pr.items.length).toBeGreaterThan(0);
      expect(String(pr.items[0].sellerOrganizationId)).toBe(sellerOrgId);
    });

    it('07 buyer: cart empty after purchase request', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/cart')
        .set('Authorization', `Bearer ${buyerToken}`);
      const cart = okData<{ items: unknown[] }>(res);
      expect(cart.items.length).toBe(0);
    });

    it('08 seller: list purchase orders sees PENDING_SELLER_APPROVAL', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/seller/purchase-orders')
        .set('Authorization', `Bearer ${sellerToken}`);
      const list = okData<{
        data: { id: number; purchaseRequestId: number; status: string }[];
      }>(res);
      const row = list.data.find(
        (o) => o.purchaseRequestId === purchaseRequestId,
      );
      expect(row).toBeDefined();
      expect(row!.status).toBe('PENDING_SELLER_APPROVAL');
      sellerOrderId = row!.id;
    });

    it('09 seller: approve → READY_TO_PURCHASE on single-seller request', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/seller/purchase-orders/${sellerOrderId}/approve`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({ shippingFee: 0 });
      const order = okData<{ status: string; orderLines: unknown[] }>(res);
      expect(order.status).toBe('APPROVED');
      expect(order.orderLines.length).toBeGreaterThan(0);

      const prRes = await request(app.getHttpServer())
        .get(`/api/purchase-requests/${purchaseRequestId}`)
        .set('Authorization', `Bearer ${buyerToken}`);
      const pr = okData<{ status: string }>(prRes);
      expect(pr.status).toBe('READY_TO_PURCHASE');
    });

    it('10 seller: record purchase + shipping', async () => {
      const rec = await request(app.getHttpServer())
        .post(`/api/seller/purchase-orders/${sellerOrderId}/record-purchase`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          platform: 'OTHER',
          note: 'flow e2e',
        });
      const purchased = okData<{ status: string }>(rec);
      expect(purchased.status).toBe('PURCHASED');

      const ship = await request(app.getHttpServer())
        .patch(`/api/seller/purchase-orders/${sellerOrderId}/shipping`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          shippingStatus: 'DELIVERED',
          deliveredAt: new Date().toISOString(),
        });
      const after = okData<{ shippingStatus: string }>(ship);
      expect(after.shippingStatus).toBe('DELIVERED');

      const prRes = await request(app.getHttpServer())
        .get(`/api/purchase-requests/${purchaseRequestId}`)
        .set('Authorization', `Bearer ${buyerToken}`);
      const pr = okData<{ status: string }>(prRes);
      expect(pr.status).toBe('PURCHASED');
    });

    it('11 auth/me reflects session user', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${buyerToken}`);
      const me = okData<{
        user: { id: string };
        organization: { id: string };
      }>(res);
      expect(me.user.id).toBe(buyerUserId);
      expect(me.organization.id).toBe(buyerOrgId);
    });
  },
);
