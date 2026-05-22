import "dotenv/config";
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local", override: true });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

try {
  const rows = await prisma.$queryRaw`SELECT now() AS now, current_database() AS db, current_user AS usr`;
  console.log("OK pooled:", rows);
  const profileCount = await prisma.profile.count();
  console.log("profiles count:", profileCount);
} catch (err) {
  console.error("FAIL:", err.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
