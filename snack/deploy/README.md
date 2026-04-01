# EC2·운영 배포 (담당자용)

## 1. EC2

- 보안 그룹: SSH(22), HTTP(80), HTTPS(443). DB·Redis는 퍼블릭 오픈 금지.  
- Docker 설치 후 `docker compose` 동작 확인.

## 2. 저장소 & `.env`

```bash
git clone <repo> snack && cd snack
cp .env.example .env
# DATABASE_URL, REDIS_*, JWT_*, SMTP_*, FRONTEND_URL 등
```

RDS 등 외부 DB면 컨테이너/EC2에서 도달 가능한 호스트로 `DATABASE_URL` 설정.

## 3. API 기동

저장소 **루트**에서:

```bash
docker compose -f deploy/docker-compose.ec2.yml up -d --build
```

컨테이너 부팅 시 `prisma migrate deploy` 실행(환경변수 `SKIP_MIGRATIONS=true` 로 끌 수 있음).

EC2 내부 확인: `curl -sS http://127.0.0.1:3000/api/health`

## 4. Nginx + TLS

`nginx.example.conf` 참고. HTTPS 권장.

## 5. 부팅 자동 기동 (선택)

`snack-api.docker.service` → `/etc/systemd/system/`, `WorkingDirectory` 를 실제 클론 경로로 수정 후 `systemctl enable --now`.

## 6. 이미지만

```bash
docker build -t snack-api:latest .
```

---

**로컬 MySQL + 마이그레이션**은 프로젝트 루트 `docker-compose.yml` — 팀원 안내는 [docs/TEAM.md](../docs/TEAM.md).
