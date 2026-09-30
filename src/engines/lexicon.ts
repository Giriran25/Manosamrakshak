import type { EmotionTag } from '@/types';

/**
 * Transparent term lists for the prototype's linguistic stream (Stream B).
 *
 * PRODUCTION DIRECTION: replaced by fine-tuned multilingual encoders
 * (MuRIL / IndicBERT) producing distress-dimension scores, with IndicWhisper
 * transcription ahead of it for voice and IVRS. Public stress-language corpora
 * such as Dreaddit serve only as a general stress-language benchmark; they are
 * not data about victims of atrocities and are not described as such anywhere
 * in this product.
 */

export interface LexiconEntry {
  emotion: EmotionTag;
  weight: 1 | 2 | 3;
  terms: string[];
}

export const DISTRESS_LEXICON: LexiconEntry[] = [
  {
    emotion: 'hopeless',
    weight: 3,
    terms: ['hopeless', 'no point', 'pointless', 'give up', 'giving up', 'nothing will change', 'no future', 'worthless'],
  },
  {
    emotion: 'fearful',
    weight: 3,
    terms: ['threat', 'threatened', 'threatening', 'scared', 'afraid', 'unsafe', 'followed me', 'warned me', 'intimidat'],
  },
  {
    emotion: 'overwhelmed',
    weight: 2,
    terms: ['too much', 'cannot cope', 'cant cope', 'breaking down', 'overwhelmed', 'drowning', 'pressure'],
  },
  {
    emotion: 'anxious',
    weight: 2,
    terms: ['anxious', 'panic', 'worried', 'worry', 'restless', 'cannot sleep', 'cant sleep', 'sleepless', 'tense'],
  },
  { emotion: 'sad', weight: 2, terms: ['sad', 'crying', 'cry', 'tears', 'empty', 'low', 'broken'] },
  { emotion: 'angry', weight: 1, terms: ['angry', 'anger', 'furious', 'unfair', 'injustice', 'frustrated'] },
  { emotion: 'lonely', weight: 2, terms: ['alone', 'lonely', 'no one', 'nobody', 'isolated', 'avoiding me', 'ignored'] },
  { emotion: 'exhausted', weight: 2, terms: ['exhausted', 'tired', 'drained', 'no energy', 'cannot get up', 'weak'] },
];

export const POSITIVE_TERMS = [
  'better',
  'improving',
  'improved',
  'calmer',
  'calm',
  'hopeful',
  'supported',
  'helped',
  'helping',
  'relieved',
  'easier',
  'stronger',
  'thankful',
];

export const INTENSIFIERS = [
  'always',
  'every day',
  'everyday',
  'constantly',
  'again and again',
  'cannot',
  'cant',
  'never',
  'worse',
  'still',
  'again',
];

/** Deterministic tie-break order when several emotions match equally. */
export const EMOTION_PRIORITY: EmotionTag[] = [
  'hopeless',
  'fearful',
  'overwhelmed',
  'anxious',
  'sad',
  'angry',
  'lonely',
  'exhausted',
  'improving',
  'uncertain',
  'neutral',
];

/**
 * Crisis phrases for the deterministic safety override. Matching here bypasses
 * the scoring pipeline entirely - see engines/safety.ts.
 */
export const CRISIS_PHRASES = {
  self_harm: [
    'kill myself',
    'end my life',
    'end it all',
    'take my life',
    'suicide',
    'suicidal',
    'hang myself',
    'harm myself',
    'hurt myself',
    'do not want to live',
    'dont want to live',
    'not want to live',
    'better off dead',
  ],
  threat_to_life: [
    'they will kill me',
    'kill us',
    'kill me',
    'burn my house',
    'burn our house',
    'attack my family',
    'they will finish me',
    'death threat',
  ],
  active_intimidation: [
    'came to my house',
    'waiting outside',
    'told me to withdraw',
    'forced me to withdraw',
    'withdraw the case',
    'drop the case',
    'threatened my children',
    'followed me home',
  ],
} as const;

/** Guards that must not trigger the override when they surround a crisis phrase. */
export const NEGATION_GUARDS = [
  'do not want to',
  'dont want to',
  'never want to',
  'would not',
  'wouldnt',
  'used to',
  'no longer',
  'not going to',
  'afraid that i might',
];

export const normalizeText = (input: string): string =>
  input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['`]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
