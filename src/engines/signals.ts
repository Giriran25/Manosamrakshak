import type { EmotionTag, InteractionResponse, SignalFeatures, VoiceFeatures } from '@/types';
import { clamp, mad, mean } from '@/lib/math';
import {
  DISTRESS_LEXICON,
  EMOTION_PRIORITY,
  INTENSIFIERS,
  POSITIVE_TERMS,
  normalizeText,
} from './lexicon';
import { detectCrisis } from './safety';

/**
 * SignalExtractionEngine - Streams B (linguistic), C (paralinguistic) and
 * D (behavioural). Pure and deterministic: no clocks, no randomness.
 */

export interface TextSignalResult {
  score: number | null;
  emotion: EmotionTag;
  lexiconScore: number | null;
  likertScore: number | null;
  matchedTerms: string[];
}

/** Maps a 1-5 structured answer (5 = hardest) onto the 0-100 distress range. */
const LIKERT_MAP: Record<number, number> = { 1: 10, 2: 30, 3: 50, 4: 72, 5: 90 };

export const extractTextSignal = (responses: InteractionResponse[]): TextSignalResult => {
  const freeText = responses
    .map((r) => r.freeText ?? '')
    .filter((t) => t.trim().length > 0)
    .join(' . ');
  const normalized = normalizeText(freeText);

  const likertValues = responses
    .map((r) => r.value)
    .filter((v): v is number => typeof v === 'number' && v >= 1 && v <= 5)
    .map((v) => LIKERT_MAP[v]);
  const likertScore = likertValues.length > 0 ? mean(likertValues) : null;

  let negPoints = 0;
  const emotionWeights = new Map<EmotionTag, number>();
  const matchedTerms: string[] = [];

  if (normalized.length > 0) {
    for (const entry of DISTRESS_LEXICON) {
      for (const term of entry.terms) {
        if (normalized.includes(term)) {
          negPoints += entry.weight;
          matchedTerms.push(term);
          emotionWeights.set(entry.emotion, (emotionWeights.get(entry.emotion) ?? 0) + entry.weight);
        }
      }
    }
  }

  const posHits = normalized.length > 0 ? POSITIVE_TERMS.filter((t) => normalized.includes(t)) : [];
  const intensHits = normalized.length > 0 ? INTENSIFIERS.filter((t) => normalized.includes(t)) : [];
  const posPoints = posHits.length * 2;

  const lexiconScore =
    normalized.length === 0
      ? null
      : clamp(22 + 9 * negPoints + 5 * intensHits.length - 8 * posPoints);

  let score: number | null;
  if (likertScore !== null && lexiconScore !== null) {
    score = clamp(0.55 * likertScore + 0.45 * lexiconScore);
  } else {
    score = likertScore ?? lexiconScore;
  }

  // Emotion selection: strongest matched weight, ties broken by fixed priority.
  let emotion: EmotionTag = 'neutral';
  if (emotionWeights.size > 0) {
    const maxWeight = Math.max(...emotionWeights.values());
    emotion =
      EMOTION_PRIORITY.find((tag) => emotionWeights.get(tag) === maxWeight) ?? 'uncertain';
  } else if (posHits.length > 0) {
    emotion = 'improving';
  } else if (score !== null && score >= 60) {
    emotion = 'uncertain';
  } else if (score !== null) {
    emotion = 'neutral';
  } else {
    emotion = 'uncertain';
  }

  // A clearly positive report should not read as a distress emotion.
  if (posHits.length > 0 && negPoints === 0) emotion = 'improving';

  return {
    score: score === null ? null : Math.round(score),
    emotion,
    lexiconScore,
    likertScore,
    matchedTerms,
  };
};

export interface BehaviourInput {
  missedCheckins: number;
  latencyMs: number;
  baselineLatencyMs: number | null;
  textLength: number;
  baselineTextLength: number | null;
  completion: 'complete' | 'partial' | 'abandoned';
}

export const extractBehaviourSignal = (input: BehaviourInput): number => {
  const latencyRatio = input.baselineLatencyMs
    ? Math.min(3, Math.max(0.5, input.latencyMs / input.baselineLatencyMs))
    : 1;
  const lengthRatio = input.baselineTextLength
    ? Math.min(2, Math.max(0, input.textLength / input.baselineTextLength))
    : 1;
  const completionPenalty =
    input.completion === 'partial' ? 8 : input.completion === 'abandoned' ? 16 : 0;

  return Math.round(
    clamp(
      28 +
        11 * input.missedCheckins +
        18 * (latencyRatio - 1) +
        16 * Math.max(0, 1 - lengthRatio) +
        completionPenalty,
    ),
  );
};

/**
 * Stream C. Strictly a within-person deviation from this person's own voice
 * baseline - never an absolute cross-person classifier. Returns null when
 * there is no personal voice baseline to compare against.
 */
export const extractVoiceSignal = (
  current: VoiceFeatures | undefined,
  baseline: VoiceFeatures | null,
  baselineSamples: VoiceFeatures[] = [],
): number | null => {
  if (!current || !baseline) return null;

  const spread = (pick: (v: VoiceFeatures) => number, fallback: number): number => {
    const values = baselineSamples.map(pick);
    const m = mad(values);
    return m > 0.0001 ? m : fallback;
  };

  const zPause = (current.pauseRatio - baseline.pauseRatio) / spread((v) => v.pauseRatio, 0.05);
  const zVar =
    (current.energyVariation - baseline.energyVariation) / spread((v) => v.energyVariation, 0.05);
  const zSpeak =
    (current.speakingRatio - baseline.speakingRatio) / spread((v) => v.speakingRatio, 0.05);

  return Math.round(clamp(50 + 6 * zPause - 5 * zVar - 4 * zSpeak));
};

/**
 * Observed distress at a single interaction, independent of history. Used as
 * the quantity the personal baseline is built from, which keeps the baseline
 * deviation stream free of circular dependence on the fused score.
 */
export const compositeRawDistress = (
  text: number | null,
  behaviour: number | null,
  voice: number | null,
): number | null => {
  const parts: Array<[number, number]> = [];
  if (text !== null) parts.push([text, 0.6]);
  if (behaviour !== null) parts.push([behaviour, 0.3]);
  if (voice !== null) parts.push([voice, 0.1]);
  if (parts.length === 0) return null;
  const totalWeight = parts.reduce((a, [, w]) => a + w, 0);
  return Math.round(parts.reduce((a, [v, w]) => a + v * w, 0) / totalWeight);
};

export interface BuildSignalsInput {
  responses: InteractionResponse[];
  behaviour: BehaviourInput;
  voice?: VoiceFeatures;
  voiceBaseline?: VoiceFeatures | null;
  voiceBaselineSamples?: VoiceFeatures[];
}

export const buildSignalFeatures = (input: BuildSignalsInput): SignalFeatures => {
  const text = extractTextSignal(input.responses);
  const behaviour = extractBehaviourSignal(input.behaviour);
  const voice = extractVoiceSignal(
    input.voice,
    input.voiceBaseline ?? null,
    input.voiceBaselineSamples ?? [],
  );
  const freeText = input.responses.map((r) => r.freeText ?? '').join(' ');
  const crisis = detectCrisis(freeText);

  return {
    textDistress: text.score,
    behaviourDistress: behaviour,
    voiceSignal: voice,
    compositeRaw: compositeRawDistress(text.score, behaviour, voice),
    emotion: text.emotion,
    crisisFlag: crisis.matched,
    crisisCategory: crisis.category,
  };
};
