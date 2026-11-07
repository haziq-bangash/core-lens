import { after } from 'next/server';
import { createClient } from 'redis';
import { createResumableStreamContext, type ResumableStreamContext } from 'resumable-stream';

/**
 * Resumable chat streams over Redis, built so that Redis trouble can never take chat down.
 *
 * resumable-stream creates its own clients when none are passed. Those have no 'error'
 * listener (an idle connection closed by Upstash's proxy becomes an uncaughtException) and
 * their initial connect() result is cached forever (one failed connect poisons every later
 * request until the container restarts). So we own the clients instead.
 */

const READY_TIMEOUT_MS = 2000;
const UNAVAILABLE_COOLDOWN_MS = 15_000;

let context: ResumableStreamContext | null = null;
let clients: ReturnType<typeof createRedisClient>[] = [];
let connecting: Promise<unknown> = Promise.resolve();
let lastWarning = 0;
let skipWaitUntil = 0;

function warn(message: string, error?: unknown) {
  const now = Date.now();
  if (now - lastWarning < 30_000) return;
  lastWarning = now;
  console.warn(`[resumable-stream] ${message}`, error instanceof Error ? error.message : (error ?? ''));
}

function createRedisClient(url: string) {
  const client = createClient({
    url,
    // Fail commands immediately while disconnected instead of queueing them, so a Redis
    // outage turns into a fast fallback rather than a hung chat request.
    disableOfflineQueue: true,
    // Keep the connection warm so the proxy doesn't close it for being idle.
    pingInterval: 30_000,
    socket: {
      reconnectStrategy: (retries) => Math.min(250 * 2 ** retries, 10_000),
    },
  });

  client.on('error', (error) => warn('Redis client error:', error));
  return client;
}

function isReady() {
  return clients.length > 0 && clients.every((client) => client.isReady);
}

/**
 * Returns a ready resumable-stream context, or null when Redis is unconfigured or
 * unreachable. Callers should fall back to a plain (non-resumable) stream on null.
 */
export async function getStreamContext(): Promise<ResumableStreamContext | null> {
  const url = process.env.REDIS_URL || process.env.KV_URL;
  if (!url) return null;

  if (!context) {
    const publisher = createRedisClient(url);
    const subscriber = createRedisClient(url);
    clients = [publisher, subscriber];

    context = createResumableStreamContext({
      waitUntil: after,
      // The client types are compatible at runtime; node-redis v5's generics are just wider.
      publisher: publisher as never,
      subscriber: subscriber as never,
    });

    connecting = Promise.all(clients.map((client) => client.connect())).catch((error) =>
      warn('Initial Redis connection failed:', error),
    );
  }

  if (!isReady() && Date.now() >= skipWaitUntil) {
    await Promise.race([connecting, new Promise((resolve) => setTimeout(resolve, READY_TIMEOUT_MS))]);
    // Still down: don't make every chat request wait again for a while.
    if (!isReady()) skipWaitUntil = Date.now() + UNAVAILABLE_COOLDOWN_MS;
  }

  return isReady() ? context : null;
}
