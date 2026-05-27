# 📘 SNACK API

이 프로젝트는 **조직(기업) 단위 간식 구매·예산 관리**를 위한 B2B 백엔드입니다.  
**카탈로그·장바구니·구매 요청·판매자 주문 승인·월별 예산·예산 예약·지출·감사 로그** 흐름을 제공합니다.

---

# 🚀 Base URL

- 모든 요청·응답은 **JSON** 형식입니다.
- API 경로 앞에는 전역 prefix **`/api`** 가 붙습니다.
- 로컬 개발 기본 포트: **3000**

| 환경 | URL |
|------|-----|
| 로컬 | `http://localhost:3000` |
| 배포 (Render) | `https://snack-xlvk.onrender.com` |
| 프론트 (Vercel) | `https://frontend042.vercel.app` |

헬스체크:

```
GET /api/health
```

---

# 🧱 API 구조

API는 다음 도메인으로 구성됩니다:

| 영역 | Prefix | 기능 |
|------|--------|------|
| **Auth** | `/api/auth` | 회원가입·로그인·토큰 갱신·비밀번호 찾기/변경 |
| **Users** | `/api/users` | 사용자 프로필 |
| **Organizations** | `/api/organizations` | 조직·멤버·역할(`OrgRole`) 관리 |
| **Invitations** | `/api/invitations` | 조직 초대·수락 |
| **Categories / Products** | `/api/categories`, `/api/products` | 판매 카탈로그 |
| **Cart** | `/api/cart` | 구매자 조직·사용자별 장바구니 |
| **PurchaseRequest** | `/api/purchase-requests` | 장바구니 → 구매 요청 스냅샷 |
| **SellerOrder** | `/api/seller/purchase-orders` | 판매자 PO 조회·승인·거절·구매 완료 |
| **Budget** | `/api/budget/*` | 월별 예산·기본값·예산 예약 |
| **Expenses** | `/api/expenses` | 구매 완료 후 지출 확정 |
| **Audit** | `/api/audit-logs` | 감사 로그 조회 |
| **Health** | `/api/health` | 서비스·DB 상태 |

Swagger 문서로 전체 API 확인 가능:

| 항목 | URL |
|------|-----|
| Swagger UI | `{BASE_URL}/api/docs` |
| OpenAPI JSON | `{BASE_URL}/api/openapi.json` |
| OpenAPI YAML | `{BASE_URL}/api/openapi.yaml` |

> 스펙은 `@nestjs/swagger` 데코레이터에서 **자동 생성**됩니다. 코드 변경이 곧 API 문서 변경입니다.

팀 연동용 요약: [docs/TEAM.md](./docs/TEAM.md)

---

# ✅ 공통 성공 응답 형식

전역 `ResponseInterceptor`로 래핑됩니다.

```json
{
  "success": true,
  "data": { }
}
```

---

# ⚠️ 공통 에러 응답 형식

`HttpExceptionFilter` 기준:

```json
{
  "success": false,
  "statusCode": 400,
  "errorCode": "VALIDATION_FAILED",
  "path": "/api/...",
  "timestamp": "2026-05-28T12:00:00.000Z",
  "message": "에러 설명"
}
```

### 공통 상태 코드

| 코드 | 의미 |
|------|------|
| 400 | 잘못된 요청 (ValidationPipe 실패 등) |
| 401 | 인증 필요 / 토큰 무효 |
| 403 | 권한 없음 (역할·조직 불일치) |
| 404 | 존재하지 않는 리소스 |
| 409 | 충돌 (중복 가입, **예산 부족**, 이미 예약된 PO 등) |
| 429 | 전역 rate limit (`THROTTLE_TTL`초당 `THROTTLE_LIMIT`회, 기본 60초당 70회) |
| 500 | 서버 내부 에러 (production에서는 message 일반화) |

---

# 🔐 인증 (프론트 필수)

1. `POST /api/auth/login` (또는 `signup` 후 `issueAuthTokens`)  
2. 응답 `data.tokens.accessToken` 저장  
3. 이후 요청: **`Authorization: Bearer <accessToken>`**  
4. Swagger: **Authorize** → Bearer에 토큰 입력  

JWT payload (`JwtPayload`):

| 필드 | 설명 |
|------|------|
| `sub` | 사용자 ID |
| `email` | 이메일 |
| `organizationId` | **현재 조직** (장바구니·구매·판매 주문·예산의 기준) |
| `role` | 조직 내 역할 `OrgRole` |
| `sessionId` | 세션 식별 |

CORS: `credentials: true`, `Authorization` 헤더 허용.

공개(인증 불필요) 예: `POST /api/auth/signup`, `login`, `refresh`, `forgot-password`, `reset-password`, 초대 토큰 조회 등 — 상세는 Swagger **Auth**, **Invitations** 태그 참고.

---

# 📚 도메인 규칙 설명

Swagger만으로는 “왜 이렇게 동작하는지”가 드러나지 않는 부분을 정리했습니다.

---

## 🟦 1. Organizations (조직·권한)

- **개인/기업 `OrgType` 구분 없음.** 조직은 `name` + 선택적 `businessNumber`만 가집니다.
- 권한은 **멤버십 `OrgRole`** 로만 구분합니다.

| `OrgRole` | 설명 |
|-----------|------|
| `MEMBER` | 일반 구매 요청·장바구니 |
| `ADMIN` | 조직 관리·즉시 구매 등 관리자 기능 |
| `SUPER_ADMIN` | 최고 관리자 (예산 수동 보정·멤버 역할 변경 등) |

회원가입 시 새 조직을 만들면 해당 사용자는 보통 **`SUPER_ADMIN`** 으로 등록됩니다.

---

## 🟩 2. Cart → PurchaseRequest (구매자)

1. `GET/POST/PATCH/DELETE /api/cart/*` — **JWT `organizationId` + 사용자** 기준 장바구니  
2. `POST /api/purchase-requests` — 현재 장바구니를 **구매 요청 스냅샷**으로 만들고 **카트 비움**  
3. 판매자 조직별로 PO(`SellerOrder`)가 갈라져 생성됨  

**즉시 구매 (`instantCheckout`)**  
- `ADMIN` / `SUPER_ADMIN` 전용  
- 자체 판매 상품만 있을 때 승인·구매완료·지출까지 한 트랜잭션으로 처리  
- `MEMBER`가 요청하면 **403**, 예산 부족 시 **409**

`PurchaseRequestStatus` 예: `OPEN` → `PARTIALLY_APPROVED` → `READY_TO_PURCHASE` → `PURCHASED` / `REJECTED` / `CANCELED`

---

## 🟨 3. SellerOrder (판매자 PO)

- 경로 prefix: `/api/seller/purchase-orders`  
- JWT의 **`organizationId` = 판매자 조직** 기준으로 목록·상세·승인  

**승인 (`POST .../approve`)** — 핵심 비즈니스 규칙:

- 상태: `PENDING_SELLER_APPROVAL` → `APPROVED`  
- **같은 Prisma `$transaction`** 안에서 구매자 조직의 **월 가용 예산**으로  
  `items_amount + shipping_fee` 만큼 **예산 예약(`budget_reservations`, ACTIVE)** 생성  
- 가용액 부족 → **409**  
- 해당 PO에 이미 예약이 있으면 중복 생성하지 않음  

거절·취소 시 예약은 **RELEASED** 등으로 해제됩니다.

---

## 🟧 4. Budget (예산·예약)

| 개념 | 설명 |
|------|------|
| `budget_periods` | 구매자 조직 **연·월별** 예산 상한 (없으면 `default_monthly_budget`로 자동 생성) |
| `budget_reservations` | **PO당 1건** — `ACTIVE` → `CONSUMED` / `RELEASED` |
| `POST /api/budget/reservations` | 수동 예약(보통 SUPER_ADMIN 보정). 이미 PO 예약 있으면 **409** |

**판매자 승인 시 예약이 자동 생성**되므로, 프론트는 보통 수동 예약 API를 쓰지 않습니다.

관련 API:

- `GET/PATCH /api/budget/periods` — 월별 예산  
- `GET/PATCH /api/budget/monthly-default` — 조직 기본 월 예산  
- `GET/POST/PATCH /api/budget/reservations` — 예약 조회·생성·상태 변경  

---

## 🟥 5. Expenses (지출)

- PO가 **`PURCHASED`** 된 뒤 `POST /api/expenses` 로 지출 확정  
- 해당 PO에 **ACTIVE 예약**이 있으면 자동 **`CONSUMED`** 처리  

---

## 🟪 6. Audit (감사 로그)

- 주요 상태 변경·승인·예산 작업 등이 `audit_logs`에 기록  
- `GET /api/audit-logs` — 조직·기간 등 쿼리로 조회 (권한은 Swagger·서비스 로직 참고)

---

# 🛠 로컬 실행

```bash
cp .env.example .env
docker compose up -d    # MySQL (+ Redis 등 compose 정의에 따름)
npm install
npm run start:dev
```

| 명령 | 설명 |
|------|------|
| `npm run start:dev` | 개발 서버 (watch) |
| `npm run build` / `start:prod` | 프로덕션 빌드·실행 |
| `npm run compose:up` | Docker Compose 기동 |
| `npm run test` | 단위 테스트 |
| `npm run test:e2e` | E2E (`test/flow.e2e-spec.ts`, `RUN_FLOW_E2E=1` 시 전체 플로우) |

배포(EC2·PM2·GitHub Actions): [deploy/README.md](./deploy/README.md)

---

# 📁 폴더 구조 (요약)

```
snack/
├── prisma/              # schema, migrations
├── src/
│   ├── auth/            # JWT, signup/login
│   ├── organizations/   # 조직·멤버·OrgRole
│   ├── invitation/
│   ├── modules/
│   │   ├── catalog/     # categories, products
│   │   ├── cart/
│   │   ├── purchase-request/
│   │   ├── seller-order/
│   │   ├── finance/     # budget, expenses, audit-log
│   │   └── audit/
│   ├── common/          # guards, filters, interceptors
│   ├── health/
│   └── main.ts          # Swagger, CORS, rate limit
├── test/                # e2e
├── docs/                # TEAM.md 등
└── deploy/
```

---

# 🔗 FE 연동 시 체크리스트

- [ ] `NEXT_PUBLIC_API_BASE_URL` = 배포 BE URL (기본값 예: `https://snack-xlvk.onrender.com`)  
- [ ] API 호출 시 `Authorization: Bearer`  
- [ ] Swagger `{BASE_URL}/api/docs`에서 토큰 **Authorize** 후 플로우 검증  
- [ ] 구매 플로우: Cart → PurchaseRequest → Seller approve → (예산 예약) → Purchase → Expense  
- [ ] 409 응답: 예산 부족·중복 예약 등 — UI 메시지 분기  

---

# 👥 팀·CI

- 팀 온보딩: [docs/TEAM.md](./docs/TEAM.md)  
- GitHub Actions: `.github/workflows/backend-ci.yml` (lint·test)  
- Render: `render.yaml` — 서비스 `snack-backend`, health `/api/health`
