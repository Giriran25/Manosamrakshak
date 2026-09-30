import { CRISIS_PHRASES, NEGATION_GUARDS, normalizeText } from './lexicon';

/**
 * SafetyOverrideEngine.
 *
 * Deterministic and rule-based. It runs before and independently of scoring.
 * An explicit statement of self-harm intent, threat to life or active
 * intimidation bypasses the scoring pipeline completely and routes to a human,
 * whatever the score or the confidence says.
 *
 * Prototype scope: this routes inside the application and writes an audit
 * event. It does not contact any emergency service and the product never
 * claims that it does. A production deployment requires a verified 24x7 human
 * responder rota behind this path before it can be described as an
 * intervention.
 */

export type CrisisCategory = 'self_harm' | 'threat_to_life' | 'active_intimidation';

export interface CrisisDetection {
  matched: boolean;
  category: CrisisCategory | null;
  /** Category only. The matched sentence is never stored or logged. */
}

const CATEGORY_ORDER: CrisisCategory[] = ['self_harm', 'threat_to_life', 'active_intimidation'];

/** True when a negation guard sits immediately before the phrase. */
const isGuarded = (haystack: string, phraseIndex: number): boolean => {
  const window = haystack.slice(Math.max(0, phraseIndex - 44), phraseIndex);
  return NEGATION_GUARDS.some((guard) => window.includes(guard));
};

export const detectCrisis = (text: string): CrisisDetection => {
  const normalized = normalizeText(text);
  if (normalized.length === 0) return { matched: false, category: null };

  for (const category of CATEGORY_ORDER) {
    for (const phrase of CRISIS_PHRASES[category]) {
      const index = normalized.indexOf(phrase);
      if (index >= 0 && !isGuarded(normalized, index)) {
        return { matched: true, category };
      }
    }
  }
  return { matched: false, category: null };
};

export const CRISIS_CATEGORY_LABELS: Record<CrisisCategory, string> = {
  self_harm: 'Explicit self-harm statement',
  threat_to_life: 'Stated threat to life',
  active_intimidation: 'Active intimidation or pressure to withdraw',
};
