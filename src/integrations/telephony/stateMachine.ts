import type { InteractionResponse } from '@/types';

/**
 * The IVRS state machine.
 *
 * Pure and server-side. A real call arrives as a sequence of independent
 * webhook requests, so the state cannot live in a frontend component: each
 * request carries a call id, the machine is loaded, advanced by one digit, and
 * saved again. The browser console drives exactly the same machine, which is
 * why what a presenter demonstrates is what a real caller would get.
 */

export type IvrsState =
  | 'connected'
  | 'intro'
  | 'question_1'
  | 'question_2'
  | 'question_3'
  | 'processing'
  | 'request_counsellor'
  | 'complete';

export type Digit = '1' | '2' | '3' | '4' | '5';

export interface IvrsSession {
  callId: string;
  caseId: string;
  state: IvrsState;
  responses: InteractionResponse[];
  startedAt: string;
  lastPromptAt: string;
  /** Digits received, newest last. Kept for the console, not for scoring. */
  presses: Array<{ digit: Digit; at: string; state: IvrsState }>;
  counsellorRequested: boolean;
  /** Set once the interaction has been created, so a retry cannot duplicate it. */
  interactionId: string | null;
}

export interface Prompt {
  state: IvrsState;
  /** What the caller hears. Spoken by the provider's text-to-speech. */
  say: string;
  /** Whether the machine is waiting for a keypad digit. */
  expectsInput: boolean;
  /** Digits that mean something in this state. */
  accepts: Digit[];
  /** True once the call should be hung up. */
  hangUp: boolean;
}

const QUESTION_IDS: Record<'question_1' | 'question_2' | 'question_3', string> = {
  question_1: 'q1-feeling',
  question_2: 'q2-difficulty',
  question_3: 'q3-support',
};

export const PROMPTS: Record<IvrsState, Prompt> = {
  connected: {
    state: 'connected',
    say: 'Connecting your support check-in.',
    expectsInput: false,
    accepts: [],
    hangUp: false,
  },
  intro: {
    state: 'intro',
    say: 'Welcome. This is your support check-in. Press 1 to begin, 2 to hear this again, 3 to speak to a counsellor, or 4 to end the call.',
    expectsInput: true,
    accepts: ['1', '2', '3', '4'],
    hangUp: false,
  },
  question_1: {
    state: 'question_1',
    say: 'How have you been feeling since your last check-in? Press 1 for better, 3 for about the same, 5 for much worse.',
    expectsInput: true,
    accepts: ['1', '2', '3', '4', '5'],
    hangUp: false,
  },
  question_2: {
    state: 'question_2',
    say: 'Has anything to do with your case been difficult? Press 1 for no, 3 for somewhat, 5 for yes.',
    expectsInput: true,
    accepts: ['1', '2', '3', '4', '5'],
    hangUp: false,
  },
  question_3: {
    state: 'question_3',
    say: 'How supported do you feel at the moment? Press 1 for well supported, 3 for somewhat, 5 for not supported.',
    expectsInput: true,
    accepts: ['1', '2', '3', '4', '5'],
    hangUp: false,
  },
  processing: {
    state: 'processing',
    say: 'Thank you. Recording your check-in.',
    expectsInput: false,
    accepts: [],
    hangUp: false,
  },
  request_counsellor: {
    state: 'request_counsellor',
    say: 'Your request has been recorded. Counsellor contact will be handled through the support workflow. Goodbye.',
    expectsInput: false,
    accepts: [],
    hangUp: true,
  },
  complete: {
    state: 'complete',
    say: 'Thank you. Your check-in has been recorded. Goodbye.',
    expectsInput: false,
    accepts: [],
    hangUp: true,
  },
};

export const createSession = (callId: string, caseId: string, nowIso: string): IvrsSession => ({
  callId,
  caseId,
  state: 'intro',
  responses: [],
  startedAt: nowIso,
  lastPromptAt: nowIso,
  presses: [],
  counsellorRequested: false,
  interactionId: null,
});

export interface AdvanceResult {
  session: IvrsSession;
  prompt: Prompt;
  /** True when the machine has just finished collecting answers. */
  completedNow: boolean;
  /** True when the digit meant nothing in this state and the prompt repeats. */
  ignored: boolean;
}

/** Maps a keypad digit onto the same 1-5 structured scale every channel uses. */
const digitToValue = (digit: Digit): number => Number(digit);

export const advance = (session: IvrsSession, digit: Digit, nowIso: string): AdvanceResult => {
  const current = PROMPTS[session.state];

  if (!current.expectsInput || !current.accepts.includes(digit)) {
    return { session, prompt: current, completedNow: false, ignored: true };
  }

  const presses = [...session.presses, { digit, at: nowIso, state: session.state }];

  // 4 ends the call, and 3 from the menu asks for a person. Both are terminal.
  if (digit === '4') {
    return {
      session: { ...session, presses, state: 'complete', lastPromptAt: nowIso },
      prompt: PROMPTS.complete,
      completedNow: session.responses.length > 0,
      ignored: false,
    };
  }

  if (session.state === 'intro') {
    if (digit === '3') {
      return {
        session: {
          ...session,
          presses,
          state: 'request_counsellor',
          counsellorRequested: true,
          lastPromptAt: nowIso,
        },
        prompt: PROMPTS.request_counsellor,
        completedNow: false,
        ignored: false,
      };
    }
    if (digit === '2') {
      // Repeat: same state, prompt replayed.
      return {
        session: { ...session, presses, lastPromptAt: nowIso },
        prompt: PROMPTS.intro,
        completedNow: false,
        ignored: false,
      };
    }
    return {
      session: { ...session, presses, state: 'question_1', lastPromptAt: nowIso },
      prompt: PROMPTS.question_1,
      completedNow: false,
      ignored: false,
    };
  }

  if (
    session.state === 'question_1' ||
    session.state === 'question_2' ||
    session.state === 'question_3'
  ) {
    const latencyMs = Math.max(
      600,
      new Date(nowIso).getTime() - new Date(session.lastPromptAt).getTime(),
    );
    const response: InteractionResponse = {
      questionId: QUESTION_IDS[session.state],
      // Question 2 asks what is difficult rather than how bad it is, so it
      // carries context and not a rating - exactly as in the chat channel.
      value: session.state === 'question_2' ? null : digitToValue(digit),
      latencyMs,
    };
    const responses = [...session.responses, response];

    const next: IvrsState =
      session.state === 'question_1'
        ? 'question_2'
        : session.state === 'question_2'
          ? 'question_3'
          : 'complete';

    return {
      session: { ...session, presses, responses, state: next, lastPromptAt: nowIso },
      prompt: PROMPTS[next],
      completedNow: next === 'complete',
      ignored: false,
    };
  }

  return { session, prompt: current, completedNow: false, ignored: true };
};

export const IVRS_FLOW: IvrsState[] = [
  'intro',
  'question_1',
  'question_2',
  'question_3',
  'complete',
];
