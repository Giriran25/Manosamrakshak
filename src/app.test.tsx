// @vitest-environment jsdom
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from './App';
import { useAppStore } from './store/useAppStore';
import { DEMO_PASSWORD, HERO_CASE_ID, VICTIM_DEMO_CASE_ID } from './data/demoScenario';

/**
 * Rendering smoke tests.
 *
 * These exist to catch the class of failure a unit test on the engines cannot:
 * a screen that throws on mount, a route that resolves to nothing, a control
 * that does not change the state it claims to change. They walk the same path
 * the demo does.
 */

const renderAt = (path: string) =>
  render(
    <MemoryRouter
      initialEntries={[path]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <App />
    </MemoryRouter>,
  );

const signIn = async (username: string) => {
  await act(async () => {
    useAppStore.getState().signIn(username, DEMO_PASSWORD);
  });
  await act(async () => {
    await useAppStore.getState().init();
  });
};

beforeEach(() => {
  useAppStore.getState().signOut();
  window.localStorage.clear();
});

afterEach(cleanup);

describe('public routes', () => {
  it('renders the landing page', () => {
    renderAt('/');
    expect(document.body.textContent ?? '').toMatch(/crisis/i);
    expect(screen.getAllByRole('link', { name: /Enter platform/i }).length).toBeGreaterThan(0);
  });

  it('renders the login page with the demo accounts listed', () => {
    renderAt('/login');
    expect(screen.getByText(/Know who needs attention/i)).toBeTruthy();
    expect(screen.getByText(`counsellor / ${DEMO_PASSWORD}`)).toBeTruthy();
  });

  it('renders the how-it-works page including the pipeline figure', () => {
    renderAt('/about');
    expect(screen.getByText(/From a check-in to a decision/i)).toBeTruthy();
    expect(screen.getByText(/The counsellor decides\./i)).toBeTruthy();
    expect(document.querySelector('svg[role="img"]')).toBeTruthy();
  });

  it('sends an unauthenticated visitor from a protected route to the login', () => {
    renderAt('/counsellor');
    expect(screen.getByText(/Know who needs attention/i)).toBeTruthy();
  });

  it('renders a recovery screen for an unknown address', () => {
    renderAt('/nowhere');
    expect(screen.getByText(/There is nothing at this address/i)).toBeTruthy();
  });
});

describe('victim portal', () => {
  it('renders the home screen without showing a score or a band', async () => {
    await signIn('victim');
    renderAt('/victim');
    await waitFor(() => expect(screen.getByText(VICTIM_DEMO_CASE_ID)).toBeTruthy());

    const body = document.body.textContent ?? '';
    expect(body).not.toMatch(/High priority|Support priority|Escalation risk|Confidence/i);
    expect(body).not.toMatch(/(^|\s)(Elevated|Watch)(\s|$)/);
    expect(body).toMatch(/Next check-in/i);
  });

  it('renders every victim route', async () => {
    await signIn('victim');
    for (const path of ['/victim/check-in', '/victim/trend', '/victim/case', '/victim/support']) {
      const view = renderAt(path);
      await waitFor(() => expect(document.body.textContent ?? '').not.toMatch(/^\s*$/));
      view.unmount();
    }
  });

  it('records a chat check-in and establishes the personal baseline', async () => {
    await signIn('victim');
    renderAt('/victim/check-in');

    // The surface opens on the channel chooser, not on a question.
    const chat = await screen.findByRole('button', { name: /Chat/i });
    await act(async () => {
      fireEvent.click(chat);
    });

    await screen.findByText(/How have you been feeling/i, {}, { timeout: 5000 });
    expect(useAppStore.getState().baselines[VICTIM_DEMO_CASE_ID]?.status).toBe('establishing');

    for (const label of ['A little worse', 'Case delays', 'Somewhat supported']) {
      const option = await screen.findByRole('button', { name: label });
      await act(async () => {
        fireEvent.click(option);
      });
      const advance = await screen.findByRole('button', { name: /^(Continue|Submit)$/i });
      await act(async () => {
        fireEvent.click(advance);
      });
    }

    await waitFor(() =>
      expect(useAppStore.getState().baselines[VICTIM_DEMO_CASE_ID]?.status).toBe('established'),
    );
    // A victim session loads that person's own case and nothing else, so the
    // rest of the district - including the scripted hero case - is not even
    // present in memory to be disturbed.
    expect(useAppStore.getState().cases.map((c) => c.caseId)).toEqual([VICTIM_DEMO_CASE_ID]);
    expect(useAppStore.getState().assessments[HERO_CASE_ID]).toBeUndefined();
  });

  it('withdrawing consent deletes the derived features', async () => {
    await signIn('victim');
    const before = useAppStore
      .getState()
      .interactions.filter((e) => e.caseId === VICTIM_DEMO_CASE_ID);
    expect(before.some((e) => e.extractedSignals.textDistress !== null)).toBe(true);

    await act(async () => {
      useAppStore.getState().setPassiveConsent(VICTIM_DEMO_CASE_ID, false);
    });

    const after = useAppStore
      .getState()
      .interactions.filter((e) => e.caseId === VICTIM_DEMO_CASE_ID);
    expect(after.every((e) => e.extractedSignals.textDistress === null)).toBe(true);
    expect(after.every((e) => e.extractedSignals.voiceSignal === null)).toBe(true);
    expect(
      useAppStore.getState().audit.some((entry) => entry.action === 'consent_changed'),
    ).toBe(true);
  });
});

describe('counsellor surface', () => {
  it('renders the overview with the district figures', async () => {
    await signIn('counsellor');
    renderAt('/counsellor');
    await waitFor(() => expect(screen.getByRole('heading', { name: /Overview/i })).toBeTruthy());
    expect(screen.getByText(/Active cases/i)).toBeTruthy();
    expect(screen.getAllByText(HERO_CASE_ID).length).toBeGreaterThan(0);
  });

  it('renders the queue with the hero case and its capacity cap', async () => {
    await signIn('counsellor');
    renderAt('/counsellor/queue');
    await waitFor(() => expect(screen.getByText(/Today.s priority queue/i)).toBeTruthy());
    expect(screen.getAllByText(HERO_CASE_ID).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/review capacity/i).length).toBeGreaterThan(0);
  });

  it('renders the case list and the follow-up queue', async () => {
    await signIn('counsellor');
    const list = renderAt('/counsellor/cases');
    await waitFor(() => expect(screen.getByText(/District record/i)).toBeTruthy());
    list.unmount();

    renderAt('/counsellor/followups');
    await waitFor(() => expect(screen.getByText(/Adaptive support/i)).toBeTruthy());
  });

  it('ranks the hero case at the top of the queue', async () => {
    await signIn('counsellor');
    const { selectQueue } = await import('./store/useAppStore');
    const queue = selectQueue(useAppStore.getState());
    expect(queue[0].caseRecord.caseId).toBe(HERO_CASE_ID);
  });

  it('renders the case detail with the scripted numbers on screen', async () => {
    await signIn('counsellor');
    renderAt(`/counsellor/case/${HERO_CASE_ID}`);
    await waitFor(() =>
      expect(screen.getByText(/moved away from their own baseline/i)).toBeTruthy(),
    );

    const body = document.body.textContent ?? '';
    expect(body).toMatch(/Baseline/);
    expect(body).toMatch(/median of this person/i);
    expect(body).toMatch(/\+48/);
    expect(body).toMatch(/Deteriorating/);
    expect(body).toMatch(/Why this case is moving up the queue/);
    expect(body).toMatch(/Ethical firewall/);
  });

  it('confirming a concern tightens the follow-up and writes the audit trail', async () => {
    await signIn('counsellor');
    renderAt(`/counsellor/case/${HERO_CASE_ID}`);
    await waitFor(() => expect(screen.getByRole('button', { name: /^Confirm$/i })).toBeTruthy());

    expect(useAppStore.getState().followUps[HERO_CASE_ID].cadence).not.toBe('within_48h');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Confirm$/i }));
    });

    expect(useAppStore.getState().followUps[HERO_CASE_ID].cadence).toBe('within_48h');
    expect(await screen.findByText(/Within 48 hours/i)).toBeTruthy();
    expect(
      useAppStore.getState().audit.some((entry) => entry.action === 'followup_changed'),
    ).toBe(true);
  });

  it('escalating records a route, and dismissing relaxes the cadence again', async () => {
    await signIn('counsellor');

    await act(async () => {
      useAppStore.getState().applyCounsellorAction({
        caseId: HERO_CASE_ID,
        kind: 'escalated',
        actorRole: 'counsellor',
        route: 'protection_request',
        note: 'Accused resident in the same ward.',
      });
    });
    expect(useAppStore.getState().followUps[HERO_CASE_ID].cadence).toBe('within_24h');

    await act(async () => {
      useAppStore.getState().applyCounsellorAction({
        caseId: HERO_CASE_ID,
        kind: 'dismissed',
        actorRole: 'counsellor',
      });
    });
    expect(useAppStore.getState().followUps[HERO_CASE_ID].cadence).toBe('within_72h');
    expect(useAppStore.getState().suppressed[HERO_CASE_ID]).toBeGreaterThan(0);

    // The note stays on the action record and never reaches the audit log.
    const audit = useAppStore.getState().audit;
    expect(audit.some((entry) => entry.outcome.includes('same ward'))).toBe(false);
    expect(audit.some((entry) => entry.outcome.includes('protection_request'))).toBe(true);
  });

  it('holds the frozen hero case at 88 across repeated scripted advances', async () => {
    await signIn('counsellor');
    for (let i = 0; i < 5; i += 1) {
      await act(async () => {
        useAppStore.getState().advanceCheckIn(HERO_CASE_ID);
      });
      const assessment = useAppStore.getState().assessments[HERO_CASE_ID];
      expect(assessment.distressScore).toBe(88);
      expect(assessment.band).toBe('high');
      expect(assessment.confidence.band).toBe('high');
    }
  });

  it('does not load a case from another district', async () => {
    await signIn('counsellor');
    const loaded = useAppStore.getState().cases.map((c) => c.districtId);
    expect(new Set(loaded).size).toBe(1);
  });
});

describe('safety override', () => {
  it('bypasses scoring, routes to human review and logs only the category', async () => {
    await signIn('victim');
    await act(async () => {
      useAppStore.getState().recordInteraction({
        caseId: VICTIM_DEMO_CASE_ID,
        channel: 'chat',
        responses: [
          {
            questionId: 'q1-feeling',
            value: 4,
            freeText: 'they came to my house and told me to withdraw the case',
            latencyMs: 5_000,
          },
        ],
      });
    });

    const state = useAppStore.getState();
    expect(state.safetyNotice).not.toBeNull();
    expect(state.assessments[VICTIM_DEMO_CASE_ID].safetyOverride).toBe(true);
    expect(state.assessments[VICTIM_DEMO_CASE_ID].recommendation.kind).toBe(
      'immediate_human_contact',
    );
    expect(state.followUps[VICTIM_DEMO_CASE_ID].cadence).toBe('within_24h');

    const entry = state.audit.find((e) => e.action === 'safety_override');
    expect(entry).toBeTruthy();
    expect(entry?.outcome).toContain('active_intimidation');
    expect(entry?.outcome).not.toContain('withdraw the case');
  });
});

describe('admin surface', () => {
  it('protects identity by default and releases only the minimum necessary', async () => {
    await signIn('admin');
    renderAt('/admin/identity');
    await waitFor(() => expect(screen.getAllByText(/Protected/i).length).toBeGreaterThan(0));

    await act(async () => {
      useAppStore.getState().requestIdentityAccess({
        caseId: HERO_CASE_ID,
        purpose: 'counselling_outreach',
        reason: 'Outreach call following a confirmed concern on this case.',
        actorRole: 'admin',
      });
    });

    const revealed = useAppStore.getState().revealed[HERO_CASE_ID];
    expect(revealed.fields).toEqual(['name', 'contact']);
    expect(revealed.fields).not.toContain('location');

    const audit = useAppStore.getState().audit;
    expect(audit.some((e) => e.action === 'identity_access_granted')).toBe(true);
    // The written justification stays on the request record.
    expect(audit.some((e) => e.outcome.includes('Outreach call'))).toBe(false);
  });

  it('renders the audit log with no personal data in it', async () => {
    await signIn('admin');
    renderAt('/admin/audit');
    await waitFor(() => expect(screen.getByText(/Every sensitive action, recorded/i)).toBeTruthy());
    const body = document.body.textContent ?? '';
    expect(body).not.toMatch(/\+91/);
  });
});

