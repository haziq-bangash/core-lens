import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Create a new ratelimiter that allows 3 requests per day for unauthenticated users
export const unauthenticatedRateLimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(3, '7 d'), // 3 requests per 1 day
  // Analytics fires extra background Redis calls that nobody reads and that
  // surface as unhandled rejections when Redis is unreachable.
  analytics: false,
  // Fail open (allow the request) if Redis doesn't answer in time.
  timeout: 2000,
  prefix: '@upstash/ratelimit:unauth',
});

/**
 * Rate-limit check that never throws. If Redis is unreachable (DNS hiccup, network
 * blip) we allow the request rather than turning a cache outage into a 500.
 */
export async function checkUnauthenticatedRateLimit(identifier: string) {
  try {
    return await unauthenticatedRateLimit.limit(identifier);
  } catch (error) {
    console.warn('[rate-limit] Redis unavailable, allowing request:', error instanceof Error ? error.message : error);
    return { success: true, limit: 0, remaining: 0, reset: 0, pending: Promise.resolve() };
  }
}

// Helper function to get IP address from request
export function getClientIdentifier(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');
  const ip = forwarded?.split(',')[0] ?? realIp ?? 'unknown';
  return `ip:${ip}`;
}
