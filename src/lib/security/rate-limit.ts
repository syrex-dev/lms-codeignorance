/**
 * Rate Limiter & Cache Key Manager bertenant.
 * Menjamin seluruh cache key, rate limit, dan job ID memuat tenantId agar tidak terjadi cross-tenant interference.
 */

interface RateLimitRecord {
  timestamps: number[];
}

const rateLimitStore = new Map<string, RateLimitRecord>();

export function makeTenantKey(tenantId: string, namespace: string, key: string): string {
  if (!tenantId || tenantId.trim() === "") {
    throw new Error("Tenant key generation requires valid tenantId");
  }
  const cleanTenant = tenantId.trim().toLowerCase();
  return `tenant:${cleanTenant}:${namespace}:${key}`;
}

export function checkTenantRateLimit(
  tenantId: string,
  action: string,
  identifier: string,
  maxRequests: number = 10,
  windowSeconds: number = 60
): { allowed: boolean; remaining: number; retryAfterSeconds?: number } {
  const compositeKey = makeTenantKey(tenantId, action, identifier);
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  let record = rateLimitStore.get(compositeKey);
  if (!record) {
    record = { timestamps: [] };
    rateLimitStore.set(compositeKey, record);
  }

  // Filter out timestamps outside current sliding window
  record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs);

  if (record.timestamps.length >= maxRequests) {
    const oldest = record.timestamps[0];
    const retryAfterSeconds = Math.ceil((oldest + windowMs - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, retryAfterSeconds),
    };
  }

  record.timestamps.push(now);
  return {
    allowed: true,
    remaining: maxRequests - record.timestamps.length,
  };
}

export function clearRateLimit(tenantId: string, action: string, identifier: string): void {
  const compositeKey = makeTenantKey(tenantId, action, identifier);
  rateLimitStore.delete(compositeKey);
}
