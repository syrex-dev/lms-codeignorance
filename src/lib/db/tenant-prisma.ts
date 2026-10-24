import { prisma, platformPrisma } from "./prisma";

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
  "topic",
  "material",
  "materialFile",
  "materialProgress",
] as const;

export type TenantScopedModel = (typeof TENANT_SCOPED_MODELS)[number];

export function isTenantScopedModel(modelName: string): boolean {
  if (!modelName) return false;
  const normalized = modelName.charAt(0).toLowerCase() + modelName.slice(1);
  return (TENANT_SCOPED_MODELS as readonly string[]).includes(normalized);
}

/**
 * Validasi ketat format tenantId (mencegah SQL injection dan format invalid)
 */
export function validateTenantId(tenantId: string | null | undefined): string {
  if (!tenantId || typeof tenantId !== "string" || tenantId.trim() === "") {
    throw new Error("Tenant context required: Query executed without institutionId (fail closed)");
  }
  const clean = tenantId.trim();
  // Format tenantId harus alphanumeric, dash, underscore, panjang 1 - 64 karakter (UUID atau slug)
  if (!/^[a-zA-Z0-9_-]+$/.test(clean) || clean.length > 64) {
    throw new Error(`Invalid tenantId format: '${clean}'. Karakter terlarang atau percobaan SQL injection ditolak.`);
  }
  return clean;
}

/**
 * Fail-Closed Guard: Memastikan query langsung tanpa konteks tenant ditolak
 */
export function assertTenantContext(institutionId: string | null | undefined): asserts institutionId is string {
  validateTenantId(institutionId);
}

/**
 * Mendapatkan Prisma Client bertenant dengan perlindungan fail-closed.
 * Mendukung top-level PrismaClient (lewat $extends) maupun transaction client tx (lewat Proxy).
 */
export function getTenantPrisma(institutionId: string, baseClient: any = prisma) {
  const cleanTenantId = validateTenantId(institutionId);

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
 * Menggunakan client role lms_platform (BYPASSRLS)
 */
export function getPlatformPrisma(operatorId: string, reason: string) {
  if (!operatorId || !reason || reason.trim().length < 5) {
    throw new Error("Platform operations require operatorId and written audit reason (min 5 chars)");
  }

  return platformPrisma;
}

/**
 * Menjalankan transaksi dengan PostgreSQL Row-Level Security (RLS) variabel session
 * Menggunakan parameterized set_config('app.current_tenant', $1, true)
 */
export async function withTenantTransaction<T>(
  institutionId: string,
  callback: (tx: any) => Promise<T>
): Promise<T> {
  const safeTenantId = validateTenantId(institutionId);

  return prisma.$transaction(async (tx) => {
    // Parameterized PostgreSQL set_config untuk penegakan RLS di level transaksi
    await tx.$executeRaw`SELECT set_config('app.current_tenant', ${safeTenantId}, true);`;

    const tenantTx = getTenantPrisma(safeTenantId, tx);
    return callback(tenantTx);
  });
}
