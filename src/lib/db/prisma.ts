import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  platformPrisma: PrismaClient | undefined;
};

// Client aplikasi utama (tersambung sebagai role lms_app - NOSUPERUSER, NOBYPASSRLS)
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: process.env.DATABASE_URL,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

// Client platform terpisah (tersambung sebagai role lms_platform - BYPASSRLS untuk lintas tenant)
export const platformPrisma =
  globalForPrisma.platformPrisma ??
  new PrismaClient({
    datasourceUrl: process.env.PLATFORM_DATABASE_URL || process.env.DATABASE_URL,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.platformPrisma = platformPrisma;
}
