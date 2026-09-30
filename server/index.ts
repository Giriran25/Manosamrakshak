import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { config, isSmsConfigured, isTelephonyConfigured, isDatabaseConfigured } from './config';
import { addClient, clientCount } from './events';
import { applyCors, logLine, sendJson } from './http';
import { handleCapabilities } from './routes/capabilities';
import { handleCreateInteraction, handleGetCase } from './routes/interactions';
import { handleSmsSend, handleSmsWebhook } from './routes/sms';
import {
  handleIvrsConsoleStart,
  handleIvrsSession,
  handleIvrsTestCall,
  handleIvrsWebhook,
} from './routes/ivrs';
import { handleTranscribe } from './routes/transcribe';

/**
 * The API server.
 *
 * Deliberately dependency-free on node:http rather than a framework: webhook
 * signature verification needs the exact raw request body, and doing the
 * reading by hand makes that guarantee visible instead of trusting a body
 * parser to preserve it.
 *
 * Nothing here logs a phone number, a message body, a transcript or a
 * credential.
 */

const route = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
  const url = new URL(req.url ?? '/', config.publicUrl);
  const path = url.pathname.replace(/\/$/, '') || '/';
  const method = req.method ?? 'GET';

  applyCors(req, res);
  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (path === '/api/health' && method === 'GET') {
    sendJson(res, 200, { ok: true, listeners: clientCount() });
    return;
  }

  if (path === '/api/capabilities' && method === 'GET') {
    await handleCapabilities(req, res);
    return;
  }

  if (path === '/api/interactions' && method === 'POST') {
    await handleCreateInteraction(req, res);
    return;
  }

  const caseMatch = /^\/api\/cases\/([A-Za-z0-9-]{1,32})$/.exec(path);
  if (caseMatch && method === 'GET') {
    handleGetCase(req, res, caseMatch[1]);
    return;
  }

  // Live activity stream for the counsellor dashboard.
  if (path === '/api/events' && method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write(': connected\n\n');
    addClient(res);
    const keepAlive = setInterval(() => {
      try {
        res.write(': ping\n\n');
      } catch {
        clearInterval(keepAlive);
      }
    }, 25_000);
    res.on('close', () => clearInterval(keepAlive));
    return;
  }

  if (path === '/api/sms/webhook' && method === 'POST') {
    await handleSmsWebhook(req, res);
    return;
  }
  if (path === '/api/sms/send' && method === 'POST') {
    await handleSmsSend(req, res);
    return;
  }

  if (path === '/api/ivrs/voice' && method === 'POST') {
    await handleIvrsWebhook(req, res);
    return;
  }
  if (path === '/api/ivrs/session' && method === 'GET') {
    handleIvrsSession(req, res);
    return;
  }
  if (path === '/api/ivrs/console' && method === 'POST') {
    await handleIvrsConsoleStart(req, res);
    return;
  }
  if (path === '/api/ivrs/call' && method === 'POST') {
    await handleIvrsTestCall(req, res);
    return;
  }

  if (path === '/api/voice/transcribe' && method === 'POST') {
    await handleTranscribe(req, res);
    return;
  }

  sendJson(res, 404, { error: 'not found' });
};

const server = createServer((req, res) => {
  void route(req, res).catch((error: unknown) => {
    // The message is logged for the operator; the caller gets nothing back but
    // a status, so a stack trace can never reach a screen.
    logLine(`unhandled error on ${req.method} ${req.url}: ${(error as Error).message}`);
    if (!res.headersSent) sendJson(res, 500, { error: 'internal error' });
  });
});

server.listen(config.port, () => {
  logLine(`listening on ${config.publicUrl}`);
  logLine(`sms provider: ${isSmsConfigured() ? config.sms.provider : 'not configured'}`);
  logLine(`telephony provider: ${isTelephonyConfigured() ? config.telephony.provider : 'not configured'}`);
  logLine(`database: ${isDatabaseConfigured() ? 'configured' : 'not configured'}`);
  logLine(`demo case: ${config.demoCaseId}`);
});
