import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/** `prisma generate`는 DB 연결 없음. CI/Docker 빌드 등 URL 미설정 시 placeholder만 필요. */
const databaseUrl =
  process.env.DATABASE_URL?.trim() ||
  'mysql://ci:ci@127.0.0.1:3306/ci_placeholder';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: databaseUrl,
  },
});
