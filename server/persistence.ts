import type { Assessment, InteractionEvent } from '@/types';
import { config, isDatabaseConfigured } from './config';

/**
 * Database persistence.
 *
 * Writes through the Supabase REST endpoint with the service-role key, which
 * never leaves the server. Persistence is best-effort by design: if the
 * database is unreachable the interaction has already been scored and
 * broadcast, so the demo continues and the failure is reported rather than
 * thrown.
 *
 * Raw audio is never written. Only the summary voice measures reach this
 * layer, because the recording is discarded at extraction.
 */

export type PersistenceOutcome =
  | { ok: true; skipped?: false }
  | { ok: true; skipped: true; reason: string }
  | { ok: false; reason: string };

const post = async (table: string, rows: unknown[]): Promise<PersistenceOutcome> => {
  const url = `${config.supabase.url}/rest/v1/${table}`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        apikey: config.supabase.serviceRoleKey as string,
        Authorization: `Bearer ${config.supabase.serviceRoleKey}`,
        'Content-Type': 'application/json',
        // Ignore a repeated primary key rather than failing a provider retry.
        Prefer: 'resolution=ignore-duplicates,return=minimal',
      },
      body: JSON.stringify(rows),
    });
    if (!response.ok) {
      return { ok: false, reason: `database rejected the write (HTTP ${response.status})` };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: 'database unreachable' };
  }
};

export const persistInteraction = async (
  event: InteractionEvent,
  assessment: Assessment,
): Promise<PersistenceOutcome> => {
  if (!isDatabaseConfigured()) {
    return { ok: true, skipped: true, reason: 'no database configured' };
  }

  const interaction = await post('interaction_events', [
    {
      id: event.id,
      case_ref: event.caseId,
      channel: event.channel,
      started_at: event.startedAt,
      completed_at: event.completedAt,
      completion: event.completion,
      // Structured answers and optional free text. No audio, ever.
      responses: event.responses,
      latency_ms: event.latencyMs,
      text_length: event.textLength,
      confidence: event.confidence,
      is_synthetic: event.isSynthetic,
    },
  ]);
  if (!interaction.ok) return interaction;

  const features = await post('signal_features', [
    {
      interaction_id: event.id,
      text_distress: event.extractedSignals.textDistress,
      behaviour_distress: event.extractedSignals.behaviourDistress,
      voice_signal: event.extractedSignals.voiceSignal,
      composite_raw: event.extractedSignals.compositeRaw,
      emotion: event.extractedSignals.emotion,
      crisis_flag: event.extractedSignals.crisisFlag,
      // Category only. The sentence that triggered it is never stored.
      crisis_category: event.extractedSignals.crisisCategory,
      voice_duration_ms: event.voice?.durationMs ?? null,
      voice_mean_energy: event.voice?.meanEnergy ?? null,
      voice_energy_var: event.voice?.energyVariation ?? null,
      voice_pause_ratio: event.voice?.pauseRatio ?? null,
      voice_speak_ratio: event.voice?.speakingRatio ?? null,
    },
  ]);
  if (!features.ok) return features;

  return post('risk_scores', [
    {
      case_ref: assessment.caseId,
      computed_at: assessment.computedAt,
      distress_score: assessment.distressScore,
      band: assessment.band,
      escalation_14d: assessment.escalationRisk14d,
      baseline: assessment.baseline,
      deviation: assessment.deviation,
      trend: assessment.trend,
      slope: assessment.slope,
      confidence: assessment.confidence.overall,
      contributions: assessment.contributions,
      factors: assessment.factors,
      safety_override: assessment.safetyOverride,
    },
  ]);
};

/** A cheap reachability check used by the capabilities endpoint. */
export const checkDatabase = async (): Promise<'connected' | 'not_configured' | 'error'> => {
  if (!isDatabaseConfigured()) return 'not_configured';
  try {
    const response = await fetch(`${config.supabase.url}/rest/v1/`, {
      headers: { apikey: config.supabase.serviceRoleKey as string },
    });
    return response.ok || response.status === 404 ? 'connected' : 'error';
  } catch {
    return 'error';
  }
};
