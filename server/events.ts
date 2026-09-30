import type { ServerResponse } from 'node:http';
import type { Channel } from '@/types';

/**
 * Live activity hub.
 *
 * Server-sent events, one stream per connected dashboard. When a real
 * interaction is ingested through any channel, every counsellor view is told
 * immediately, so the queue moves without a refresh.
 *
 * Only the case reference and the stage reached are broadcast. Nothing a
 * person wrote or said travels over this channel.
 */

export type LiveEventKind =
  | 'interaction_received'
  | 'signals_extracted'
  | 'assessment_updated'
  | 'review_recommended'
  | 'safety_override'
  | 'call_state';

export interface LiveEvent {
  kind: LiveEventKind;
  caseId: string;
  channel: Channel | null;
  at: string;
  detail: string;
}

const clients = new Set<ServerResponse>();

export const addClient = (res: ServerResponse): void => {
  clients.add(res);
  res.on('close', () => clients.delete(res));
};

export const clientCount = (): number => clients.size;

export const broadcast = (event: LiveEvent): void => {
  const payload = `event: live\ndata: ${JSON.stringify(event)}\n\n`;
  for (const client of clients) {
    try {
      client.write(payload);
    } catch {
      clients.delete(client);
    }
  }
};

/**
 * The sequence a counsellor sees when a check-in lands: received, read as
 * signals, re-scored, and - only when the gate says so - proposed for review.
 */
export const broadcastIngestSequence = (input: {
  caseId: string;
  channel: Channel;
  band: string;
  recommendation: string;
  safetyOverride: boolean;
}): void => {
  const at = new Date().toISOString();
  broadcast({
    kind: 'interaction_received',
    caseId: input.caseId,
    channel: input.channel,
    at,
    detail: `${input.channel} check-in received`,
  });
  broadcast({
    kind: 'signals_extracted',
    caseId: input.caseId,
    channel: input.channel,
    at,
    detail: 'Signals extracted',
  });
  broadcast({
    kind: 'assessment_updated',
    caseId: input.caseId,
    channel: input.channel,
    at,
    detail: `Assessment updated, band ${input.band}`,
  });
  if (input.safetyOverride) {
    broadcast({
      kind: 'safety_override',
      caseId: input.caseId,
      channel: input.channel,
      at,
      detail: 'Safety override, routed for immediate human review',
    });
  } else if (
    input.recommendation === 'counsellor_contact_24h' ||
    input.recommendation === 'human_review_required' ||
    input.recommendation === 'counsellor_review'
  ) {
    broadcast({
      kind: 'review_recommended',
      caseId: input.caseId,
      channel: input.channel,
      at,
      detail: 'Counsellor review recommended',
    });
  }
};
