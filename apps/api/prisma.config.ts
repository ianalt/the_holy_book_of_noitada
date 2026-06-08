import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Prisma 7: schema no longer holds the datasource URL; Migrate reads it from here.
// The runtime PrismaClient uses @prisma/adapter-pg (wired in the infrastructure layer).
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
