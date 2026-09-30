import type { IncomingMessage, ServerResponse } from 'node:http';
import { config } from './config';

/**
 * Small HTTP helpers.
 *
 * Deliberately dependency-free: webhook signature verification needs the exact
 * raw body, and a hand-rolled reader makes that explicit rather than relying on
 * a framework's body parser to preserve it.
 */

export const MAX_BODY_BYTES = 64 * 1024;

export const readRawBody = (req: IncomingMessage): Promise<string> =>
  new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });

export const parseForm = (raw: string): Record<string, string> => {
  const params = new URLSearchParams(raw);
  const out: Record<string, string> = {};
  for (const [key, value] of params.entries()) out[key] = value;
  return out;
};

export const parseJson = <T>(raw: string): T | null => {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

export const applyCors = (req: IncomingMessage, res: ServerResponse): void => {
  const origin = req.headers.origin;
  if (origin && config.allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Idempotency-Key');
};

export const sendJson = (res: ServerResponse, status: number, payload: unknown): void => {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
};

export const sendText = (
  res: ServerResponse,
  status: number,
  contentType: string,
  body: string,
): void => {
  res.writeHead(status, {
    'Content-Type': contentType,
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
};

/** The absolute URL of this request, which is what a signature is computed over. */
export const absoluteUrl = (req: IncomingMessage): string => {
  const path = req.url ?? '/';
  return `${config.publicUrl.replace(/\/$/, '')}${path}`;
};

/**
 * Fixed-window rate limit, per address and route. Enough to stop a webhook
 * endpoint being hammered without pulling in a dependency.
 */
const windows = new Map<string, { count: number; resetAt: number }>();

export const rateLimit = (
  key: string,
  limit: number,
  windowMs = 60_000,
): { ok: boolean; retryAfter: number } => {
  const now = Date.now();
  const entry = windows.get(key);
  if (!entry || entry.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  entry.count += 1;
  if (entry.count > limit) {
    return { ok: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  return { ok: true, retryAfter: 0 };
};

export const clientKey = (req: IncomingMessage, route: string): string => {
  const forwarded = req.headers['x-forwarded-for'];
  const address =
    (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim() ??
    req.socket.remoteAddress ??
    'unknown';
  return `${route}:${address}`;
};

/**
 * Diagnostics only. Phone numbers, message bodies, transcripts and credentials
 * are never passed to this.
 */
export const logLine = (message: string): void => {
  console.info(`[server] ${message}`);
};
