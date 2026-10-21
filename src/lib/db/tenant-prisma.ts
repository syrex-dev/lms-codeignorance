import { prisma } from "./prisma";

export const TENANT_SCOPED_MODELS = [
  "user",
  "userIdentifier",
  "membership",
  "studentProfile",
  "staffProfile",
  "academicTerm",
  "programDepartment",
  "classCourse",
  "room",
  "timeSlot",
  "scheduleEntry",
  "examSchedule",
  "announcement",
  "admissionPeriod",
  "applicant",
  "loginAttempt",
  "auditLog",
  "questionBank",
  "notification",
  "otpChallenge",
  "feeComponent",
  "invoice",
  "scholarshipSponsor",
  "scholarshipScheme",
  "sponsorInvoice",
  "subscription",
  "usageRecord",
  "tenantFeatureOverride",
  "tenantDomain",
  "idCounter",
] as const;

export type TenantScopedModel = (typeof TENANT_SCOPED_MODELS)[number];

export function isTenantScopedModel(modelName: string): boolean {
  if (!modelName) return false;
  const normalized = modelName.charAt(0).toLowerCase() + modelName.slice(1);
  return (TENANT_SCOPED_MODELS as readonly string[]).includes(normalized);
}

/**
 * Mendapatkan Prisma Client bertenant dengan perlindungan fail-closed.
 * Mendukung top-level PrismaClient (lewat $extends) maupun transaction client tx (lewat Proxy).
 */
export function getTenantPrisma(institutionId: string, baseClient: any = prisma) {
  if (!institutionId || typeof institutionId !== "string" || institutionId.trim() === "") {
    throw new Error("Tenant context required: Query executed without institutionId (fail closed)");
  }

  const cleanTenantId = institutionId.trim();

  // 1. Jika baseClient memiliki $extends (top-level client)
  if (typeof baseClient.$extends === "function") {
    return baseClient.$extends({
      name: `tenant-prisma-${cleanTenantId}`,
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }: any) {
            if (model && isTenantScopedModel(model)) {
              const currentArgs = (args || {}) as any;

              if (["findMany", "findFirst", "count", "aggregate", "groupBy"].includes(operation)) {
                currentArgs.where = {
                  ...(currentArgs.where || {}),
                  institutionId: cleanTenantId,
                };
              }

              if (operation === "findUnique" || operation === "findUniqueOrThrow") {
                const modelKey = model.charAt(0).toLowerCase() + model.slice(1);
                return baseClient[modelKey].findFirst({
                  ...currentArgs,
                  where: {
                    ...(currentArgs.where || {}),
                    institutionId: cleanTenantId,
                  },
                });
              }

              if (operation === "create") {
                currentArgs.data = {
                  ...(currentArgs.data || {}),
                  institutionId: cleanTenantId,
                };
              } else if (operation === "createMany") {
                if (Array.isArray(currentArgs.data)) {
                  currentArgs.data = currentArgs.data.map((item: any) => ({
                    ...item,
                    institutionId: cleanTenantId,
                  }));
                }
              }

              if (["update", "updateMany", "delete", "deleteMany", "upsert"].includes(operation)) {
                currentArgs.where = {
                  ...(currentArgs.where || {}),
                  institutionId: cleanTenantId,
                };
                if (operation === "upsert") {
                  currentArgs.create = {
                    ...(currentArgs.create || {}),
                    institutionId: cleanTenantId,
                  };
                }
              }

              return query(currentArgs);
            }

            return query(args);
          },
        },
      },
    });
  }

  // 2. Jika baseClient adalah transaction client tx (tidak memiliki $extends bawaan),
  // bungkus dengan Proxy agar query mutation dan reading tetap terikat ke cleanTenantId
  return new Proxy(baseClient, {
    get(target, propKey: string) {
      const origProp = target[propKey];
      if (typeof propKey === "string" && isTenantScopedModel(propKey)) {
        return new Proxy(origProp, {
          get(modelTarget, methodKey: string) {
            const origMethod = modelTarget[methodKey];
            if (typeof origMethod === "function") {
              return function (...args: any[]) {
                const currentArgs = (args[0] || {}) as any;
                if (["findMany", "findFirst", "count", "aggregate", "groupBy"].includes(methodKey)) {
                  currentArgs.where = {
                    ...(currentArgs.where || {}),
                    institutionId: cleanTenantId,
                  };
                } else if (methodKey === "findUnique" || methodKey === "findUniqueOrThrow") {
                  return modelTarget.findFirst({
                    ...currentArgs,
                    where: {
                      ...(currentArgs.where || {}),
                      institutionId: cleanTenantId,
                    },
                  });
                } else if (methodKey === "create") {
                  currentArgs.data = {
                    ...(currentArgs.data || {}),
                    institutionId: cleanTenantId,
                  };
                } else if (methodKey === "createMany") {
                  if (Array.isArray(currentArgs.data)) {
                    currentArgs.data = currentArgs.data.map((item: any) => ({
                      ...item,
                      institutionId: cleanTenantId,
                    }));
                  }
                } else if (["update", "updateMany", "delete", "deleteMany", "upsert"].includes(methodKey)) {
                  currentArgs.where = {
                    ...(currentArgs.where || {}),
                    institutionId: cleanTenantId,
                  };
                  if (methodKey === "upsert") {
                    currentArgs.create = {
                      ...(currentArgs.create || {}),
                      institutionId: cleanTenantId,
                    };
                  }
                }
                return origMethod.apply(modelTarget, [currentArgs, ...args.slice(1)]);
              };
            }
            return origMethod;
          },
        });
      }
      return origProp;
    },
  });
}

/**
 * Platform Prisma: Digunakan secara eksplisit khusus untuk operasional platform lintas-tenant
 */
export function getPlatformPrisma(operatorId: string, reason: string) {
  if (!operatorId || !reason) {
    throw new Error("Platform operations require operatorId and written audit reason");
  }

  return prisma;
}

/**
 * Fail-Closed Guard: Memastikan query langsung tanpa konteks tenant ditolak
 */
export function assertTenantContext(institutionId: string | null | undefined): asserts institutionId is string {
  if (!institutionId || typeof institutionId !== "string" || institutionId.trim() === "") {
    throw new Error("Tenant context required: Query executed without institutionId (fail closed)");
  }
}

/**
 * Menjalankan transaksi dengan PostgreSQL Row-Level Security (RLS) variabel session
 */
export async function withTenantTransaction<T>(
  institutionId: string,
  callback: (tx: any) => Promise<T>
): Promise<T> {
  assertTenantContext(institutionId);

  return prisma.$transaction(async (tx) => {
    // Set PostgreSQL session variable untuk penegakan RLS di level basis data
    const safeTenantId = institutionId.replace(/'/g, "''");
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant = '${safeTenantId}';`);

    const tenantTx = getTenantPrisma(institutionId, tx);
    return callback(tenantTx);
  });
}
