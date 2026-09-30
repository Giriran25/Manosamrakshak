import { beforeEach, describe, expect, it } from 'vitest';
import { ingest } from './ingest';
import { appendInteraction, assess, caseForPhone, getCase, normalizePhone, resetState } from './state';
import { HERO_CASE_ID, VICTIM_DEMO_CASE_ID } from '@/data/demoScenario';

/**
 * Server ingest tests.
 *
 * These exercise the path a real channel actually takes: normalize with the
 * shared engine, append, re-score, and refuse to record the same delivery
 * twice. They also pin the guarantee that matters most during a presentation -
 * the prepared hero case cannot be moved by live traffic.
 */

beforeEach(() => {
  resetState();
});

describe('real ingest', () => {
  it('scores a chat check-in from its actual content and marks it real', async () => {
    const result = await ingest({
      caseId: VICTIM_DEMO_CASE_ID,
      channel: 'chat',
      responses: [
        {
          questionId: 'q1-feeling',
          value: 4,
          freeText: 'the hearing was adjourned again and I cannot sleep',
          latencyMs: 9000,
        },
        { questionId: 'q3-support', value: 4, latencyMs: 7000 },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.event.isSynthetic).toBe(false);
    expect(result.event.channel).toBe('chat');
    expect(result.event.extractedSignals.textDistress).not.toBeNull();
    expect(result.assessment.caseId).toBe(VICTIM_DEMO_CASE_ID);
    // The third interaction is what establishes this person's baseline.
    expect(result.assessment.baseline).not.toBeNull();
  });

  it('produces a different score for a different answer', async () => {
    const low = await ingest({
      caseId: VICTIM_DEMO_CASE_ID,
      channel: 'chat',
      responses: [
        { questionId: 'q1-feeling', value: 1, freeText: 'much better and calmer', latencyMs: 4000 },
      ],
      idempotencyKey: 'low',
    });
    resetState();
    const high = await ingest({
      caseId: VICTIM_DEMO_CASE_ID,
      channel: 'chat',
      responses: [
        {
          questionId: 'q1-feeling',
          value: 5,
          freeText: 'I feel hopeless, nothing will change, I cannot cope',
          latencyMs: 18_000,
        },
      ],
      idempotencyKey: 'high',
    });

    expect(low.ok && high.ok).toBe(true);
    if (!low.ok || !high.ok) return;
    expect(high.assessment.distressScore).toBeGreaterThan(low.assessment.distressScore);
  });

  it('records a voice check-in with only summary measures', async () => {
    const result = await ingest({
      caseId: VICTIM_DEMO_CASE_ID,
      channel: 'voice',
      responses: [{ questionId: 'q1-feeling', value: null, latencyMs: 12_000 }],
      voice: {
        durationMs: 41_000,
        meanEnergy: 0.28,
        energyVariation: 0.12,
        pauseRatio: 0.46,
        speakingRatio: 0.54,
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.event.voice).toBeDefined();
    // The record carries measures, never audio.
    expect(Object.keys(result.event.voice ?? {})).toEqual([
      'durationMs',
      'meanEnergy',
      'energyVariation',
      'pauseRatio',
      'speakingRatio',
    ]);
  });

  it('refuses an unknown case', async () => {
    const result = await ingest({ caseId: 'VC-0000', channel: 'chat', responses: [] });
    expect(result.ok).toBe(false);
  });

  it('applies the safety override on real input and keeps the sentence out of the record', async () => {
    const result = await ingest({
      caseId: VICTIM_DEMO_CASE_ID,
      channel: 'sms',
      responses: [
        {
          questionId: 'q1-feeling',
          value: 5,
          freeText: 'they came to my house and told me to withdraw the case',
          latencyMs: 3000,
        },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.assessment.safetyOverride).toBe(true);
    expect(result.assessment.recommendation.kind).toBe('immediate_human_contact');
    expect(result.event.extractedSignals.crisisCategory).toBe('active_intimidation');
  });
});

describe('duplicate delivery', () => {
  it('ignores a redelivered message with the same idempotency key', async () => {
    const before = getCase(VICTIM_DEMO_CASE_ID)?.interactions.length ?? 0;

    const first = await ingest({
      caseId: VICTIM_DEMO_CASE_ID,
      channel: 'sms',
      responses: [{ questionId: 'q1-feeling', value: 4, latencyMs: 1000 }],
      idempotencyKey: 'sms:SM-42',
    });
    const second = await ingest({
      caseId: VICTIM_DEMO_CASE_ID,
      channel: 'sms',
      responses: [{ questionId: 'q1-feeling', value: 4, latencyMs: 1000 }],
      idempotencyKey: 'sms:SM-42',
    });

    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(getCase(VICTIM_DEMO_CASE_ID)?.interactions.length).toBe(before + 1);
  });

  it('derives a key when none is supplied, so identical answers are not doubled', async () => {
    const before = getCase(VICTIM_DEMO_CASE_ID)?.interactions.length ?? 0;
    const payload = {
      caseId: VICTIM_DEMO_CASE_ID,
      channel: 'chat' as const,
      responses: [{ questionId: 'q1-feeling', value: 3, latencyMs: 5000 }],
    };
    await ingest(payload);
    const again = await ingest(payload);
    expect(again.ok && again.duplicate).toBe(true);
    expect(getCase(VICTIM_DEMO_CASE_ID)?.interactions.length).toBe(before + 1);
  });
});

describe('prepared hero scenario', () => {
  it('holds VC-2291 at its presentation numbers', () => {
    const assessment = assess(HERO_CASE_ID);
    expect(assessment?.distressScore).toBe(88);
    expect(assessment?.band).toBe('high');
    expect(assessment?.trend).toBe('deteriorating');
    expect(assessment?.baseline).toBe(40);
    expect(assessment?.deviation).toBe(48);
    expect(assessment?.confidence.overall).toBe(91);
  });

  it('does not move when live interactions arrive for it', async () => {
    for (let i = 0; i < 4; i += 1) {
      const result = await ingest({
        caseId: HERO_CASE_ID,
        channel: 'chat',
        responses: [
          {
            questionId: 'q1-feeling',
            value: 1,
            freeText: 'much better, calmer and well supported',
            latencyMs: 2000,
          },
        ],
        idempotencyKey: `live-${i}`,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.assessment.distressScore).toBe(88);
      expect(result.assessment.band).toBe('high');
      expect(result.assessment.confidence.overall).toBe(91);
    }
    // The interactions are still recorded - they are simply not scored into
    // the scripted assessment.
    expect((getCase(HERO_CASE_ID)?.interactions.length ?? 0)).toBeGreaterThan(7);
  });

  it('grows the trajectory of an ordinary case but not of the frozen one', () => {
    const heroBefore = [...(getCase(HERO_CASE_ID)?.priorTrajectory ?? [])];
    const liveBefore = [...(getCase(VICTIM_DEMO_CASE_ID)?.priorTrajectory ?? [])];

    const event = {
      id: 'ie-test-1',
      caseId: VICTIM_DEMO_CASE_ID,
      channel: 'chat' as const,
      startedAt: '2026-04-14T10:00:00.000Z',
      completedAt: '2026-04-14T10:00:00.000Z',
      completion: 'complete' as const,
      responses: [],
      latencyMs: 5000,
      textLength: 0,
      extractedSignals: {
        textDistress: 60,
        behaviourDistress: 50,
        voiceSignal: null,
        compositeRaw: 57,
        emotion: 'anxious' as const,
        crisisFlag: false,
        crisisCategory: null,
      },
      confidence: 70,
      isSynthetic: false,
    };

    appendInteraction(VICTIM_DEMO_CASE_ID, event, 'traj-live');
    appendInteraction(HERO_CASE_ID, { ...event, id: 'ie-test-2', caseId: HERO_CASE_ID }, 'traj-hero');

    expect(getCase(VICTIM_DEMO_CASE_ID)?.priorTrajectory.length).toBe(liveBefore.length + 1);
    expect(getCase(HERO_CASE_ID)?.priorTrajectory).toEqual(heroBefore);
  });
});

describe('phone routing', () => {
  it('matches a registered handset to its case, ignoring formatting', () => {
    expect(caseForPhone('+91 90000 12345', '+919000012345', 'VC-3007')).toBe('VC-3007');
    expect(caseForPhone('9000012345', '+919000012345', 'VC-3007')).toBe('VC-3007');
  });

  it('refuses to route an unregistered number to any case', () => {
    expect(caseForPhone('+919999999999', '+919000012345', 'VC-3007')).toBeNull();
    expect(caseForPhone('+919000012345', null, 'VC-3007')).toBeNull();
  });

  it('normalizes to the last ten digits', () => {
    expect(normalizePhone('+91 (900) 001-2345')).toBe('9000012345');
  });
});
