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

- 같은 스택에 **Redis 컨테이너**가 포함됩니다(호스트에 Redis 포트를 열지 않음, 스택 내부 통신만). API는 compose 기본값으로 `REDIS_HOST=redis`, `REDIS_PORT=6379`이며 `.env`의 `REDIS_*`로 바꿀 수 있습니다.  
- 외부 ElastiCache만 쓰려면 compose에서 `redis` 서비스와 `REDIS_*` override를 제거하고 `.env`만 맞추면 됩니다.  
- API 컨테이너 부팅 시 `prisma migrate deploy` 실행(`SKIP_MIGRATIONS=true` 로 생략 가능).

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

## 7. GitHub Actions로 `main` → EC2 반영

1. EC2에 저장소를 한 번 클론하고 `.env`·Node·PM2(또는 Docker)를 준비합니다. GitHub Actions는 **저장소 루트**에서 `git pull`한 뒤 **`snack/`** 으로 들어가 빌드합니다.
2. GitHub 저장소 **Settings → Secrets and variables → Actions**  
   - **Secrets:** `EC2_HOST`(퍼블릭 DNS 또는 IP), `EC2_USER`(예: `ubuntu`), `EC2_SSH_KEY`(배포용 SSH 개인 키 PEM 전체)  
   - **Variables:** `EC2_REPO_ROOT` — EC2 위에서 이 저장소가 클론된 **디렉터리**(예: `/home/ubuntu/backend`). 생략 시 원격 스크립트가 `$HOME/backend`를 사용합니다.
3. `main`에 푸시되면 워크플로 `Backend CI`의 `deploy-ec2` 잡이 실행됩니다(`EC2_HOST`가 없으면 이 잡은 스킵됩니다). PM2 프로세스 이름은 기본 `snack-api`를 재시도하고, 없으면 `pm2 restart all`을 호출합니다. Docker 전용 배포라면 이 스크립트 대신 compose 명령으로 바꾸면 됩니다.
