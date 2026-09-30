import type { VoiceFeatures } from '@/types';

/**
 * Real voice feature extraction.
 *
 * Pure functions over frame-level RMS and zero-crossing measurements taken
 * from live microphone audio. Nothing here is a clinically validated emotional
 * marker and the product never describes it as one: these are simple acoustic
 * summaries, used only as a within-person deviation and never able to set the
 * band on their own.
 *
 * PRODUCTION DIRECTION: openSMILE eGeMAPS computed on-premise, with the same
 * rule that raw audio is discarded at the point of extraction.
 */

export interface FrameMeasurements {
  /** Root-mean-square amplitude per analysis frame, in 0..1. */
  rms: number[];
  /** Zero crossings per frame, normalized by frame length, in 0..1. */
  zcr: number[];
  durationMs: number;
}

export interface ExtractedVoice extends VoiceFeatures {
  /** Zero-crossing rate, retained separately as a diagnostic. */
  zeroCrossingRate: number;
  /** Count of distinct speech runs, used to describe speaking pattern. */
  speechRuns: number;
  frames: number;
}

const mean = (values: number[]): number =>
  values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;

const round = (value: number, dp = 4): number => {
  const f = 10 ** dp;
  return Math.round(value * f) / f;
};

/**
 * Silence threshold, derived from the recording itself rather than fixed, so a
 * quiet room and a noisy one are both handled. Floored so that a silent
 * recording does not classify its own noise as speech.
 */
export const silenceThreshold = (rms: number[]): number => {
  if (rms.length === 0) return 0.012;
  const sorted = [...rms].sort((a, b) => a - b);
  // The 20th percentile approximates the noise floor of this recording.
  const noiseFloor = sorted[Math.floor(sorted.length * 0.2)] ?? 0;
  const peak = sorted[sorted.length - 1] ?? 0;
  return Math.max(0.012, noiseFloor + (peak - noiseFloor) * 0.18);
};

export const extractVoiceFeatures = (input: FrameMeasurements): ExtractedVoice => {
  const { rms, zcr, durationMs } = input;

  if (rms.length === 0) {
    return {
      durationMs,
      meanEnergy: 0,
      energyVariation: 0,
      pauseRatio: 1,
      speakingRatio: 0,
      zeroCrossingRate: 0,
      speechRuns: 0,
      frames: 0,
    };
  }

  const threshold = silenceThreshold(rms);
  const voiced = rms.map((value) => value >= threshold);
  const speakingFrames = voiced.filter(Boolean).length;

  // Distinct runs of speech, which is what "speaking pattern" is describing.
  let speechRuns = 0;
  for (let i = 0; i < voiced.length; i += 1) {
    if (voiced[i] && !voiced[i - 1]) speechRuns += 1;
  }

  const meanEnergy = mean(rms);
  const variance = mean(rms.map((value) => (value - meanEnergy) ** 2));

  return {
    durationMs,
    meanEnergy: round(meanEnergy),
    energyVariation: round(Math.sqrt(variance)),
    pauseRatio: round(1 - speakingFrames / rms.length),
    speakingRatio: round(speakingFrames / rms.length),
    zeroCrossingRate: round(mean(zcr)),
    speechRuns,
    frames: rms.length,
  };
};

/** A fixed reading used only when a microphone is genuinely unavailable. */
export const SAMPLE_VOICE_FEATURES: ExtractedVoice = {
  durationMs: 38_000,
  meanEnergy: 0.31,
  energyVariation: 0.14,
  pauseRatio: 0.38,
  speakingRatio: 0.62,
  zeroCrossingRate: 0.11,
  speechRuns: 9,
  frames: 420,
};

/** Plain-language readings for the person who just spoke. No feature names. */
export const describeVoice = (
  features: ExtractedVoice,
): Array<{ label: string; value: string }> => [
  {
    label: 'Voice activity',
    value:
      features.speakingRatio >= 0.6 ? 'Steady' : features.speakingRatio >= 0.4 ? 'Moderate' : 'Quiet',
  },
  {
    label: 'Speaking pattern',
    value:
      features.pauseRatio >= 0.45
        ? 'More pauses than usual'
        : features.pauseRatio >= 0.3
          ? 'Some pauses'
          : 'Few pauses',
  },
  {
    label: 'Response completeness',
    value: features.durationMs >= 20_000 ? 'Full answer' : 'Short answer',
  },
];

/** Strips the diagnostics back to the shape the domain engine consumes. */
export const toVoiceFeatures = (features: ExtractedVoice): VoiceFeatures => ({
  durationMs: features.durationMs,
  meanEnergy: features.meanEnergy,
  energyVariation: features.energyVariation,
  pauseRatio: features.pauseRatio,
  speakingRatio: features.speakingRatio,
});
