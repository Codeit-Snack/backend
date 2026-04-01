# SNACK API (NestJS)

## 팀원 → 바로 연동

1. 담당자가 올린 **API 베이스 URL** 확인  
2. **[docs/TEAM.md](./docs/TEAM.md)** 의 표에서 `BASE_URL` 칸만 실제 주소로 바꿔 공유  
3. 브라우저에서 `{BASE_URL}/api/docs` 로 Swagger 열고, 로그인 후 **Authorize**에 access token 입력  

## 로컬 실행

```bash
cp .env.example .env
docker compose up -d
npm install
npm run start:dev
```

## 배포 (EC2 등)

[deploy/README.md](./deploy/README.md)

## 스크립트

| 명령 | 설명 |
|------|------|
| `npm run start:dev` | 개발 서버 |
| `npm run build` / `start:prod` | 프로덕션 빌드·실행 |
| `npm run compose:up` | 로컬 MySQL + 마이그레이션 |
| `npm run docker:build` | API Docker 이미지 빌드 |
