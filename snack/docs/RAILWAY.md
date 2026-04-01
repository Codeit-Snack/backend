# Railway 미리보기

별도 프로그램 **설치는 필요 없습니다.** GitHub 연동만 되어 있으면 됩니다.

## 1. 실패 원인 (Railpack / build plan)

저장소 **최상위**에는 `package.json`이 없고 **`snack/` 안에만** 있습니다.  
Railway 기본 루트로 빌드하면 프로젝트를 못 찾습니다.

**해결:** Railway → 해당 서비스 → **Settings → Root Directory** 에 `snack` 입력 후 저장, 다시 Deploy.

## 2. 변수 (Variables)

| 이름 | 설명 |
|------|------|
| `DATABASE_URL` | MySQL URL (Railway MySQL 또는 외부 RDS 등) |
| `REDIS_URL` | Redis 플러그인 쓰면 Railway가 주는 URL 그대로 붙여넣기 (권장) |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | 임의 긴 문자열 |
| `JWT_ACCESS_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` | 예: `15m`, `7d` |
| `FRONTEND_URL` | 프론트 주소 (비밀번호 재설정 링크 등) |
| `PORT` | Railway가 자동 지정하는 경우가 많음 (앱은 이미 `PORT` 사용) |

SMTP·기타는 `.env.example` 참고.

## 3. Redis

프로젝트에 **Redis 추가** 후, 변수에 `REDIS_URL`이 생기면 그 값을 백엔드 서비스에 넣습니다.  
(`REDIS_HOST`/`REDIS_PORT`만 쓰는 로컬과 달리 Railway는 URL 한 줄이 편합니다.)

## 4. 빌드 / 기동

- `snack/railway.json` 으로 **Dockerfile** 빌드를 쓰도록 해 두었습니다(레일팩 계획 단계 혼선 줄임).  
- 이미지 안 `entrypoint` 가 `prisma migrate deploy` 후 `node dist/main.js` 를 실행합니다.  
- Railpack(NPM)만 쓰고 싶다면 대시보드에서 Builder 를 바꾸고, 이때는 `package.json` 의 `postinstall`(prisma generate)이 도움이 됩니다.

## 5. 공개 URL

배포 성공 후 **Settings → Networking** 에서 도메인 생성/연결하면 Swagger는  
`https://<배포주소>/api/docs` 입니다.
