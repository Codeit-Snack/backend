# SNACK Backend - DB & Prisma 사용 가이드

## 개요

이 프로젝트의 DB 관리 방식은 다음과 같습니다.

| 구성요소      | 기술                   |
| ------------- | ---------------------- |
| Database      | MySQL (Docker)         |
| ORM           | Prisma                 |
| 스키마 기준   | SQL (`dbml/snack.sql`) |
| Backend       | NestJS                 |
| 패키지 매니저 | npm                    |

⚠️ **중요 원칙**

이 프로젝트에서는

> **SQL 파일(`dbml/snack.sql`)이 DB 스키마의 기준(Source of Truth)** 입니다.

Prisma는 DB 구조를 읽어오는 용도로만 사용합니다.

즉,

- Prisma migrate ❌ 사용하지 않음
- SQL 기반으로 스키마 관리
- Prisma는 `db pull`로 DB 구조를 읽어옴

---

# 1. 프로젝트 최초 실행 (팀원용)

## 1️⃣ 저장소 클론

```bash
git clone <repository-url>
cd snack
```

---

# 2️⃣ MySQL 실행 (Docker)

로컬 MySQL은 Docker로 실행합니다.

```bash
docker compose up -d
```

컨테이너 확인

```bash
docker ps
```

정상 실행 시

```
snack-mysql   mysql:8.0
```

컨테이너가 보여야 합니다.

---

# 3️⃣ DB 접속 정보

`.env` 파일에 DB 연결 정보가 있습니다.

```
DATABASE_URL="mysql://admin:admin@localhost:3306/snack"
```

MySQL 정보

| 항목     | 값    |
| -------- | ----- |
| USER     | admin |
| PASSWORD | admin |
| DATABASE | snack |
| PORT     | 3306  |

---

# 4️⃣ DB 스키마 생성

DB 구조는 다음 SQL 파일에 정의되어 있습니다.

```
dbml/snack.sql
```

아래 명령어로 DB에 적용합니다.

```bash
Get-Content .\dbml\snack.sql | docker exec -i snack-mysql mysql -u admin -padmin snack
```

이 명령어는

- MySQL 컨테이너 접속
- snack.sql 실행
- 테이블 생성

을 수행합니다.

---

# 5️⃣ Prisma 스키마 생성

Prisma는 DB 구조를 읽어서 모델을 생성합니다.

```bash
npx prisma db pull
```

실행되면 다음 파일이 업데이트됩니다.

```
prisma/schema.prisma
```

---

# 6️⃣ Prisma Client 생성

NestJS에서 Prisma ORM을 사용하기 위해 Client를 생성합니다.

```bash
npx prisma generate
```

---

# 개발 중 DB 구조 변경 방법

DB 구조 변경 시 반드시 아래 순서를 따릅니다.

---

## 1️⃣ SQL 수정

DB 구조는

```
dbml/snack.sql
```

파일을 수정합니다.

또는 DBML 수정 후 SQL을 다시 export 합니다.

---

## 2️⃣ 로컬 DB 초기화 (개발 환경)

개발 중에는 DB를 초기화하는 것이 가장 간단합니다.

```bash
docker compose down -v
docker compose up -d
```

---

## 3️⃣ SQL 재적용

```bash
Get-Content .\dbml\snack.sql | docker exec -i snack-mysql mysql -u admin -padmin snack
```

---

## 4️⃣ Prisma 스키마 업데이트

```bash
npx prisma db pull
```

---

## 5️⃣ Prisma Client 재생성

```bash
npx prisma generate
```

---

# Prisma Studio (선택)

DB를 GUI로 확인하고 싶으면

```bash
npx prisma studio
```

브라우저에서 테이블 데이터를 확인할 수 있습니다.

---

# ❗ 주의사항

## Prisma migrate 사용 금지

다음 명령어는 사용하지 않습니다.

```
npx prisma migrate dev
npx prisma migrate deploy
```

이 프로젝트는 SQL 기반으로 DB를 관리합니다.

---

## schema.prisma 직접 수정 금지

Prisma 모델은

```
npx prisma db pull
```

로 자동 생성됩니다.

직접 수정하면 나중에 덮어쓰기 될 수 있습니다.

---

# 자주 사용하는 명령어

## MySQL 컨테이너 확인

```
docker ps
```

---

## MySQL 접속

```
docker exec -it snack-mysql mysql -u admin -p
```

---

## 테이블 목록 확인

```sql
USE snack;
SHOW TABLES;
```

---

# 프로젝트 구조

```
snack
 ├─ dbml
 │   ├─ snack.dbml
 │   └─ snack.sql
 │
 ├─ prisma
 │   └─ schema.prisma
 │
 ├─ src
 │
 ├─ docker-compose.yml
 ├─ prisma.config.ts
 └─ .env
```

---

# 정리

| 도구            | 역할             |
| --------------- | ---------------- |
| Docker          | 로컬 MySQL 실행  |
| snack.sql       | DB 구조 정의     |
| prisma db pull  | Prisma 모델 생성 |
| prisma generate | Prisma ORM 생성  |
| NestJS          | API 서버         |

---
