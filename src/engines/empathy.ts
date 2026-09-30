import type { EmotionTag } from '@/types';

/**
 * Deterministic supportive replies.
 *
 * Chosen by a hash of the interaction id rather than at random, so the same
 * check-in always produces the same reply. Nothing here diagnoses, promises
 * safety, or claims to understand what the person is going through. There is
 * no generative model in this path and no text leaves the browser.
 */

const RESPONSES: Record<EmotionTag, string[]> = {
  sad: [
    'It sounds like this has been a heavy stretch. Thank you for telling us.',
    'That sounds difficult to carry. Your response has been recorded for your support team.',
  ],
  fearful: [
    'Feeling unsafe is a serious thing to report, and it has been recorded for your support team.',
    'Thank you for saying this. Your support team will see that safety is a concern right now.',
  ],
  anxious: [
    'A lot of uncertainty at once is hard to sit with. Thank you for checking in.',
    'Thank you for telling us. Your response has been recorded for your support team.',
  ],
  overwhelmed: [
    'That sounds like more than one person should have to hold at once.',
    'Thank you for sharing it. Your support team will see how much is going on.',
  ],
  angry: [
    'What you are describing sounds genuinely unfair, and it has been recorded as you said it.',
    'Thank you for telling us plainly. Your response has been recorded for your support team.',
  ],
  lonely: [
    'Going through this without people around you is hard. Thank you for checking in.',
    'Thank you for telling us. Your support team will see that you are managing this largely alone.',
  ],
  exhausted: [
    'Being this tired for this long takes a toll. Thank you for checking in anyway.',
    'Thank you for taking the time today, even while so tired.',
  ],
  hopeless: [
    'Thank you for being honest about how low this has felt. Your support team will see this.',
    'That is an important thing to have told us, and it has been recorded for your support team.',
  ],
  improving: [
    'It is good to hear that some of it has eased. Thank you for checking in.',
    'Thank you for the update. It helps your support team know what is working.',
  ],
  neutral: [
    'Thank you for checking in. Your response has been recorded for your support team.',
    'Thank you for taking a minute today. Your response has been recorded.',
  ],
  uncertain: [
    'Thank you for checking in. Your response has been recorded for your support team.',
    'Thank you for telling us. Your support team will see this at their next review.',
  ],
};

const hash = (input: string): number => {
  let value = 0;
  for (let i = 0; i < input.length; i += 1) {
    value = (value * 31 + input.charCodeAt(i)) >>> 0;
  }
  return value;
};

export const empathyResponse = (emotion: EmotionTag, interactionId: string): string => {
  const options = RESPONSES[emotion];
  return options[hash(interactionId) % options.length];
};

export const EMOTION_LABELS: Record<EmotionTag, string> = {
  sad: 'Low mood',
  fearful: 'Fear or intimidation',
  anxious: 'Anxiety',
  overwhelmed: 'Overwhelmed',
  angry: 'Anger at unfairness',
  lonely: 'Social isolation',
  exhausted: 'Exhaustion',
  hopeless: 'Hopelessness',
  improving: 'Improving',
  neutral: 'Neutral',
  uncertain: 'Uncertain',
};
