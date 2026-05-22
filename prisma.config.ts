import path from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig, env } from "prisma/config";

// Next.js loads .env.local automatically, but the Prisma CLI does not.
// Load it explicitly so DIRECT_URL is visible to `prisma migrate` / `prisma db pull`.
loadEnv({ path: path.resolve(process.cwd(), ".env.local") });
loadEnv({ path: path.resolve(process.cwd(), ".env"), override: false });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  // Prisma 7 removed `directUrl`. Migrate uses this URL directly, so point it at
  // the direct (port 5432) connection. The runtime client overrides this with the
  // pooled URL via `new PrismaClient({ datasourceUrl: process.env.DATABASE_URL })`.
  datasource: {
    url: env("DIRECT_URL"),
  },
});
