# 팀용 — API 연동 가이드

배포 담당자가 **아래 `BASE_URL`만 실제 주소로 바꿔** 슬랙/노션 등에 그대로 붙여 넣으면 됩니다.

| 항목 | 값 |
|------|-----|
| **BASE_URL** | `https://api.example.com` ← 운영 주소로 교체 |
| API prefix | 모든 경로 앞에 `/api` (예: `BASE_URL` + `/api/auth/login`) |
| Swagger UI | `{BASE_URL}/api/docs` |
| OpenAPI JSON | `{BASE_URL}/api/openapi.json` (코드젠·Postman import) |
| OpenAPI YAML | `{BASE_URL}/api/openapi.yaml` |

---

## 1. 응답 형식

성공 시 전역 래핑:

```json
{ "success": true, "data": { ... } }
```

에러는 HTTP 상태 + JSON 바디(프로젝트 `HttpExceptionFilter` 형식)를 따릅니다.

---

## 2. 인증

1. `POST /api/auth/login` (또는 회원가입 후 로그인)  
2. 응답 `data.tokens.accessToken` 을 저장  
3. 이후 요청 헤더: `Authorization: Bearer <accessToken>`  
4. Swagger UI: **Authorize** → Bearer 에 토큰 입력 시 이후 호출에 자동 첨부  

JWT의 **`organizationId`** 가 장바구니·구매 요청·판매자 주문·예산 등의 **현재 조직**입니다. (조직 전환 API가 있으면 토큰 갱신/재로그인 흐름을 따릅니다.)

공개(인증 불필요) 예: `POST /api/auth/signup`, `login`, `refresh`, `forgot-password`, `reset-password`, 초대 정보 조회 등 — 상세는 Swagger 태그 **Auth**, **Invitations** 참고.

---

## 3. 로컬에서 백엔드만 띄울 때

1. 저장소 루트에서 `docker compose up -d` → MySQL + `prisma migrate deploy` 자동 1회  
2. `.env` : `DATABASE_URL=mysql://admin:admin@localhost:3306/snack` (예시는 `.env.example` 참고)  
3. `npm install` → `npm run start:dev`  
4. Redis·SMTP 등은 기능 쓸 때만 필요 (없으면 해당 기능만 실패할 수 있음)

---

## 4. EC2 / 운영 배포 (담당자)

요약 절차는 [deploy/README.md](../deploy/README.md) 를 따릅니다.

**GitHub → AWS EC2 자동 반영:** `main`에 푸시되면 Actions의 `deploy-ec2` 잡이 SSH로 EC2에 접속해 `git pull`·`prisma migrate deploy`·`npm run build`·`pm2 restart`를 실행합니다. 저장소 **Settings → Secrets and variables**에 `EC2_HOST`, `EC2_USER`, `EC2_SSH_KEY`(PEM 전체)를 넣고, 클론 경로가 기본(`$HOME/backend`)이 아니면 **Variables**에 `EC2_REPO_ROOT`를 설정하세요.

---

## 5. 더 알고 싶을 때

- API 필드·검증·에러 코드: **Swagger** 또는 `openapi.json` 이 정본에 가깝습니다.  
- 이 문서와 Swagger가 겹치면 **Swagger를 우선**합니다.
