import { describe, expect, it } from 'vitest';
import { assessCase } from './pipeline';
import { detectCrisis } from './safety';
import { computeTrend } from './trend';
import { computeBaseline } from './baseline';
import { fuseSignals } from './fusion';
import { DEMO_NOW, DEMO_SCENARIO, HERO_CASE_ID, AMBIGUOUS_CASE_ID } from '@/data/demoScenario';

const assess = (caseId: string) => {
  const caseRecord = DEMO_SCENARIO.cases.find((c) => c.caseId === caseId);
  if (!caseRecord) throw new Error(`missing case ${caseId}`);
  return assessCase({
    caseRecord,
    events: DEMO_SCENARIO.events.filter((e) => e.caseId === caseId),
    interactions: DEMO_SCENARIO.interactions.filter((e) => e.caseId === caseId),
    priorTrajectory: DEMO_SCENARIO.priorTrajectories[caseId] ?? [],
    nowIso: DEMO_NOW,
  });
};

describe('hero demo case VC-2291', () => {
  it('lands on the scripted presentation numbers', () => {
    const { assessment } = assess(HERO_CASE_ID);
    expect(assessment.distressScore).toBe(88);
    expect(assessment.band).toBe('high');
    expect(assessment.baseline).toBe(40);
    expect(assessment.deviation).toBe(48);
    expect(assessment.trend).toBe('deteriorating');
    expect(assessment.confidence.overall).toBe(91);
    expect(assessment.confidence.band).toBe('high');
    expect(assessment.recommendation.kind).toBe('counsellor_contact_24h');
  });

  it('draws a seven point trajectory ending at 88', () => {
    const { trajectory } = assess(HERO_CASE_ID);
    expect(trajectory).toEqual([35, 41, 48, 61, 73, 83, 88]);
  });

  it('stays at 88 when live interactions are added, because the case is frozen', () => {
    const caseRecord = DEMO_SCENARIO.cases.find((c) => c.caseId === HERO_CASE_ID)!;
    const live = {
      ...DEMO_SCENARIO.interactions.filter((e) => e.caseId === HERO_CASE_ID)[0],
      id: 'ie-live-1',
      startedAt: DEMO_NOW,
      isSynthetic: false,
      extractedSignals: {
        textDistress: 12,
        behaviourDistress: 14,
        voiceSignal: 16,
        compositeRaw: 13,
        emotion: 'improving' as const,
        crisisFlag: false,
        crisisCategory: null,
      },
    };
    for (let i = 0; i < 5; i += 1) {
      const result = assessCase({
        caseRecord,
        events: DEMO_SCENARIO.events.filter((e) => e.caseId === HERO_CASE_ID),
        interactions: [
          ...DEMO_SCENARIO.interactions.filter((e) => e.caseId === HERO_CASE_ID),
          ...Array.from({ length: i + 1 }, (_, k) => ({ ...live, id: `ie-live-${k}` })),
        ],
        priorTrajectory: DEMO_SCENARIO.priorTrajectories[HERO_CASE_ID],
        nowIso: DEMO_NOW,
      });
      expect(result.assessment.distressScore).toBe(88);
      expect(result.assessment.band).toBe('high');
      expect(result.assessment.trend).toBe('deteriorating');
    }
  });

  it('names the case-stage stressors in its explanation', () => {
    const { assessment } = assess(HERO_CASE_ID);
    const text = assessment.factors.map((f) => `${f.title} ${f.detail}`).join(' | ');
    expect(text).toMatch(/baseline/i);
    expect(text).toMatch(/bail|relief|adjourn/i);
    expect(assessment.factors.length).toBeGreaterThanOrEqual(3);
  });
});

describe('high concern with weak evidence', () => {
  it('routes VC-1004 to human review instead of firing an alert', () => {
    const { assessment } = assess(AMBIGUOUS_CASE_ID);
    expect(assessment.band).toBe('elevated');
    expect(assessment.confidence.band).toBe('low');
    expect(assessment.recommendation.kind).toBe('human_review_required');
    expect(assessment.baseline).toBeNull();
  });
});

describe('named demo cases sit in their intended bands', () => {
  it('VC-1001 is stable and VC-1006 is improving', () => {
    const stable = assess('VC-1001').assessment;
    expect(stable.band).toBe('stable');
    expect(['stable', 'improving']).toContain(stable.trend);

    const improving = assess('VC-1006').assessment;
    expect(improving.trend).toBe('improving');
    expect(improving.band === 'stable' || improving.band === 'watch').toBe(true);
  });

  it('every seeded case produces a score continuous with its trajectory', () => {
    for (const caseRecord of DEMO_SCENARIO.cases) {
      const { assessment, trajectory } = assess(caseRecord.caseId);
      expect(assessment.distressScore).toBeGreaterThanOrEqual(0);
      expect(assessment.distressScore).toBeLessThanOrEqual(100);
      if (trajectory.length >= 2) {
        const previous = trajectory[trajectory.length - 2];
        expect(Math.abs(assessment.distressScore - previous)).toBeLessThanOrEqual(18);
      }
    }
  });
});

describe('baseline engine', () => {
  it('is establishing until three valid interactions exist', () => {
    const two = DEMO_SCENARIO.interactions.filter((e) => e.caseId === AMBIGUOUS_CASE_ID);
    expect(computeBaseline(AMBIGUOUS_CASE_ID, two).status).toBe('establishing');
    expect(computeBaseline(AMBIGUOUS_CASE_ID, two).interactionsUsed).toBe(2);
  });

  it('uses the earliest interactions so it cannot drift upward with a deterioration', () => {
    const hero = DEMO_SCENARIO.interactions.filter((e) => e.caseId === HERO_CASE_ID);
    const full = computeBaseline(HERO_CASE_ID, hero);
    const firstThreeOnly = computeBaseline(HERO_CASE_ID, hero.slice(0, 3));
    expect(full.distress).toBe(firstThreeOnly.distress);
  });
});

describe('trend engine', () => {
  it('separates a sustained rise from a single bad check-in', () => {
    expect(computeTrend([30, 31, 30, 32, 68], 30).persistence).toBe(1);
    expect(computeTrend([30, 31, 30, 32, 34], 30).persistence).toBe(0);
    expect(computeTrend([30, 38, 46, 55, 64], 30).state).toBe('deteriorating');
    expect(computeTrend([70, 62, 54, 46, 38], 60).state).toBe('improving');
  });

  it('marks a change point once the accumulated shift is sustained', () => {
    expect(computeTrend([30, 32, 48, 60, 72], 31).changePointIndex).not.toBeNull();
    expect(computeTrend([30, 29, 31, 30, 29], 30).changePointIndex).toBeNull();
  });
});

describe('fusion engine', () => {
  it('redistributes weight so the contribution table always sums to 100 percent', () => {
    const result = fuseSignals({
      caseContext: 40,
      baselineDeviation: null,
      trend: null,
      text: 60,
      behaviour: 50,
      voice: null,
    });
    const total = result.contributions.reduce((a, c) => a + c.weightPct, 0);
    expect(Math.round(total)).toBe(100);
  });

  it('never lets voice alone reach the high band', () => {
    const result = fuseSignals({
      caseContext: 20,
      baselineDeviation: 30,
      trend: 25,
      text: null,
      behaviour: null,
      voice: 100,
    });
    expect(result.score).toBeLessThan(70);
  });
});

describe('safety override', () => {
  it('fires on explicit statements across all three categories', () => {
    expect(detectCrisis('I want to end my life').category).toBe('self_harm');
    expect(detectCrisis('they said they will kill me if I testify').category).toBe('threat_to_life');
    expect(detectCrisis('they came to my house and told me to withdraw the case').category).toBe(
      'active_intimidation',
    );
  });

  it('does not fire on negated or historical phrasing', () => {
    expect(detectCrisis('I do not want to hurt myself').matched).toBe(false);
    expect(detectCrisis('I used to feel like I wanted to end my life').matched).toBe(false);
    expect(detectCrisis('the hearing was adjourned again').matched).toBe(false);
  });
});
