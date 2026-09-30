import type { IncomingMessage, ServerResponse } from 'node:http';
import { config, isAsrConfigured } from '../config';
import { clientKey, logLine, rateLimit, sendJson } from '../http';

/**
 * Optional server-side transcription.
 *
 * The primary transcription path is the browser's own speech recognition,
 * which needs no credential and keeps the audio on the device. This endpoint
 * exists for deployments that configure an on-premise or provider ASR service.
 *
 * Audio reaches this handler in memory, is forwarded once, and the buffer is
 * dropped as soon as the request returns. Nothing is written to disk, to a
 * log, or to the database. When no service is configured the endpoint says so
 * and the check-in continues on the voice measures alone.
 */

const MAX_AUDIO_BYTES = 5 * 1024 * 1024;

const readBinary = (req: IncomingMessage): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_AUDIO_BYTES) {
        reject(new Error('audio too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });

export const handleTranscribe = async (
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> => {
  const limit = rateLimit(clientKey(req, 'transcribe'), 20);
  if (!limit.ok) {
    sendJson(res, 429, { error: 'rate limited' });
    return;
  }

  if (!isAsrConfigured()) {
    sendJson(res, 409, {
      ok: false,
      transcript: null,
      reason: 'Speech transcription is not configured on this server.',
    });
    return;
  }

  let audio: Buffer | null = null;
  try {
    audio = await readBinary(req);
  } catch {
    sendJson(res, 413, { ok: false, transcript: null, reason: 'Audio payload too large.' });
    return;
  }

  try {
    const response = await fetch(config.asr.endpoint as string, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.asr.apiKey}`,
        'Content-Type': String(req.headers['content-type'] ?? 'application/octet-stream'),
      },
      body: audio,
    });

    if (!response.ok) {
      sendJson(res, 502, {
        ok: false,
        transcript: null,
        reason: `Transcription service returned HTTP ${response.status}.`,
      });
      return;
    }

    const json = (await response.json()) as { text?: string; transcript?: string };
    const transcript = json.text ?? json.transcript ?? null;
    // Length only. The transcript itself is returned to the caller, not logged.
    logLine(`transcription completed, ${transcript?.length ?? 0} characters`);
    sendJson(res, 200, { ok: true, transcript, provider: config.asr.provider });
  } catch {
    sendJson(res, 502, {
      ok: false,
      transcript: null,
      reason: 'Transcription service unreachable.',
    });
  } finally {
    // Drop the reference immediately; the buffer is never persisted anywhere.
    audio = null;
  }
};
