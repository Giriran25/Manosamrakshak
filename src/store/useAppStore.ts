import { create } from 'zustand';
import type {
  Assessment,
  AuditActionType,
  AuditLogEntry,
  CaseEvent,
  CaseRecord,
  Channel,
  CounsellorAction,
  CounsellorActionKind,
  EscalationRoute,
  FollowUp,
  IdentityAccessRequest,
  IdentityPurpose,
  IdentityRecord,
  InteractionEvent,
  InteractionResponse,
  Role,
  SessionState,
  VoiceFeatures,
} from '@/types';
import {
  assessCase,
  baselineVoiceSamples,
  cadenceForBand,
  computeBaseline,
  dueAtFor,
  normalizeInteraction,
  priorityWeight,
} from '@/engines';
import type { BaselineProfile, FollowUpCadence } from '@/types';
import {
  DEMO_NOW,
  DEMO_PASSWORD,
  DEMO_SCENARIO,
  DEMO_USERS,
  HERO_CASE_ID,
} from '@/data/demoScenario';
import { repository } from '@/services/repository';
import { nextId } from '@/lib/id';
import { daysBetween } from '@/lib/math';
import { STORAGE_KEYS, clearLocal, readLocal, writeLocal } from '@/lib/storage';
import {
  UNAVAILABLE_CAPABILITIES,
  type AppMode,
  type Capabilities,
  type ClientCapabilities,
} from '@/integrations/channels';
import {
  fetchCapabilities,
  postInteraction,
  publishLocalEvent,
  resolveClientCapabilities,
  subscribeToLiveEvents,
  type LiveEvent,
} from '@/services/apiClient';

export interface RevealedIdentity {
  record: IdentityRecord;
  fields: Array<keyof Omit<IdentityRecord, 'caseId'>>;
  expiresAt: string;
  purpose: IdentityPurpose;
}

export interface SafetyNotice {
  caseId: string;
  category: string;
  at: string;
}

interface AppState {
  session: SessionState | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;

  cases: CaseRecord[];
  events: CaseEvent[];
  interactions: InteractionEvent[];
  priorTrajectories: Record<string, number[]>;

  assessments: Record<string, Assessment>;
  trajectories: Record<string, number[]>;
  baselines: Record<string, BaselineProfile>;

  followUps: Record<string, FollowUp>;
  actions: CounsellorAction[];
  audit: AuditLogEntry[];
  identityRequests: IdentityAccessRequest[];
  revealed: Record<string, RevealedIdentity>;
  /** Cases a counsellor has dismissed, suppressed for a few check-ins. */
  suppressed: Record<string, number>;
  safetyNotice: SafetyNotice | null;
  lastInteraction: InteractionEvent | null;

  /** Demo mode keeps everything deterministic; live mode uses the real path. */
  mode: AppMode;
  capabilities: Capabilities;
  client: ClientCapabilities;
  /** What the last real ingest actually did, so the UI can be honest about it. */
  lastIngest: {
    at: string;
    channel: Channel;
    route: 'server' | 'local';
    persisted: boolean;
    duplicate: boolean;
    note: string;
  } | null;
  liveEvents: LiveEvent[];

  setMode: (mode: AppMode) => void;
  refreshCapabilities: () => Promise<void>;
  startLiveFeed: () => () => void;
  pushLiveEvent: (event: LiveEvent) => void;
  submitInteraction: (input: RecordInteractionInput) => Promise<SubmitOutcome>;
  signIn: (username: string, password: string) => { ok: boolean; session?: SessionState };
  signOut: () => void;
  init: () => Promise<void>;
  recordInteraction: (input: RecordInteractionInput) => InteractionEvent | null;
  applyCounsellorAction: (input: CounsellorActionInput) => void;
  setPassiveConsent: (caseId: string, allowed: boolean) => void;
  requestIdentityAccess: (input: IdentityRequestInput) => void;
  expireIdentityAccess: (caseId: string) => void;
  advanceCheckIn: (caseId: string) => void;
  resetDemo: () => Promise<void>;
  dismissSafetyNotice: () => void;
  log: (action: AuditActionType, subject: string, outcome: string, actorRole?: Role | 'system') => void;
}

export interface RecordInteractionInput {
  caseId: string;
  channel: Channel;
  responses: InteractionResponse[];
  voice?: VoiceFeatures;
  skipped?: number;
  startedAt?: string;
}

/** What actually happened to a submitted check-in, reported honestly to the UI. */
export interface SubmitOutcome {
  event: InteractionEvent | null;
  route: 'server' | 'local';
  persisted: boolean;
  duplicate: boolean;
  note: string;
}

export interface CounsellorActionInput {
  caseId: string;
  kind: CounsellorActionKind;
  actorRole: Role;
  route?: EscalationRoute;
  note?: string;
}

export interface IdentityRequestInput {
  caseId: string;
  purpose: IdentityPurpose;
  reason: string;
  actorRole: Role;
}

/**
 * The demo clock. Every computation is anchored to it so the scenario, the
 * queue order and the charts are identical on every run. Live interactions
 * recorded during a demo are stamped with it too, which keeps a check-in
 * performed on stage in the same time frame as the seeded history.
 */
const now = (): string => DEMO_NOW;

/** Wall-clock, used only for the action log timestamps a presenter reads out. */
const wallClock = (): string => new Date().toISOString();

const PURPOSE_FIELDS: Record<IdentityPurpose, Array<keyof Omit<IdentityRecord, 'caseId'>>> = {
  counselling_outreach: ['name', 'contact'],
  protection_request: ['name', 'location'],
  relief_escalation: ['name', 'location'],
  medical_referral: ['name', 'contact'],
};

export const PURPOSE_LABELS: Record<IdentityPurpose, string> = {
  counselling_outreach: 'Counselling outreach',
  protection_request: 'Protection request',
  relief_escalation: 'Relief escalation',
  medical_referral: 'Medical referral',
};

const IDENTITY_ACCESS_MINUTES = 5;

const emptyBundle = {
  cases: [] as CaseRecord[],
  events: [] as CaseEvent[],
  interactions: [] as InteractionEvent[],
  priorTrajectories: {} as Record<string, number[]>,
};

interface Recomputed {
  assessments: Record<string, Assessment>;
  trajectories: Record<string, number[]>;
  baselines: Record<string, BaselineProfile>;
}

const recomputeAll = (
  cases: CaseRecord[],
  events: CaseEvent[],
  interactions: InteractionEvent[],
  priorTrajectories: Record<string, number[]>,
): Recomputed => {
  const assessments: Record<string, Assessment> = {};
  const trajectories: Record<string, number[]> = {};
  const baselines: Record<string, BaselineProfile> = {};

  for (const caseRecord of cases) {
    const result = assessCase({
      caseRecord,
      events: events.filter((e) => e.caseId === caseRecord.caseId),
      interactions: interactions.filter((e) => e.caseId === caseRecord.caseId),
      priorTrajectory: priorTrajectories[caseRecord.caseId] ?? [],
      nowIso: now(),
    });
    assessments[caseRecord.caseId] = result.assessment;
    trajectories[caseRecord.caseId] = result.trajectory;
    baselines[caseRecord.caseId] = result.baselineProfile;
  }

  return { assessments, trajectories, baselines };
};

const seedFollowUps = (
  cases: CaseRecord[],
  assessments: Record<string, Assessment>,
): Record<string, FollowUp> => {
  const out: Record<string, FollowUp> = {};
  for (const c of cases) {
    const assessment = assessments[c.caseId];
    const cadence: FollowUpCadence = assessment ? cadenceForBand(assessment.band) : 'monthly';
    out[c.caseId] = {
      caseId: c.caseId,
      cadence,
      dueAt: dueAtFor(cadence, c.lastInteractionAt ?? c.openedAt),
      changedAt: c.lastInteractionAt ?? c.openedAt,
      changedBy: 'system',
      reason: 'Derived from the current support priority band.',
    };
  }
  return out;
};

export const useAppStore = create<AppState>((set, get) => ({
  session: readLocal<SessionState | null>(STORAGE_KEYS.session, null),
  status: 'idle',
  error: null,

  ...emptyBundle,
  assessments: {},
  trajectories: {},
  baselines: {},

  followUps: {},
  actions: [],
  audit: [],
  identityRequests: [],
  revealed: {},
  suppressed: {},
  safetyNotice: null,
  lastInteraction: null,

  mode: readLocal<AppMode>(STORAGE_KEYS.mode, 'demo'),
  capabilities: UNAVAILABLE_CAPABILITIES,
  client: resolveClientCapabilities(),
  lastIngest: null,
  liveEvents: [],


  setMode: (mode) => {
    writeLocal(STORAGE_KEYS.mode, mode);
    set({ mode });
    get().log(
      'data_source_selected',
      mode,
      mode === 'live'
        ? 'live mode: real channels, server processing and persistence where configured'
        : 'demo mode: deterministic seeded cases and fallback channels',
    );
  },

  refreshCapabilities: async () => {
    const capabilities = await fetchCapabilities();
    set({ capabilities, client: resolveClientCapabilities() });
  },

  /**
   * Subscribes to live activity. Server-sent events when the API is running,
   * a cross-tab broadcast otherwise, so a check-in taken in one place shows up
   * where a counsellor is looking.
   */
  startLiveFeed: () => {
    const { capabilities, pushLiveEvent } = get();
    return subscribeToLiveEvents(pushLiveEvent, { server: capabilities.server });
  },

  pushLiveEvent: (event) => {
    set((state) => ({ liveEvents: [event, ...state.liveEvents].slice(0, 40) }));
  },

  /**
   * The real submission path.
   *
   * In live mode the answers go to the server, which normalizes, scores with
   * the same engine, persists where a database is configured, and broadcasts
   * to every dashboard. If the server cannot be reached the check-in is not
   * lost: it is processed in this browser instead and the UI says so.
   */
  submitInteraction: async (input) => {
    const state = get();
    const caseRecord = state.cases.find((c) => c.caseId === input.caseId);
    if (!caseRecord) {
      return {
        event: null,
        route: 'local',
        persisted: false,
        duplicate: false,
        note: 'That case is not available to this account.',
      };
    }

    const live = state.mode === 'live' && state.capabilities.server;

    if (live) {
      const idempotencyKey = `${input.caseId}:${input.channel}:${nextId('sub')}`;
      const outcome = await postInteraction({
        caseId: input.caseId,
        channel: input.channel,
        responses: input.responses,
        voice: input.voice,
        skipped: input.skipped,
        isSynthetic: false,
        idempotencyKey,
      });

      if (outcome.ok) {
        // The server is authoritative in live mode: adopt its event and its
        // assessment rather than scoring the same answers twice.
        const event = outcome.result.event;
        const interactions = state.interactions.some((e) => e.id === event.id)
          ? state.interactions
          : [...state.interactions, event];
        const cases = state.cases.map((c) =>
          c.caseId === input.caseId ? { ...c, lastInteractionAt: event.startedAt } : c,
        );
        const priorTrajectories = {
          ...state.priorTrajectories,
          [input.caseId]: outcome.result.trajectory.slice(0, -1),
        };
        const computed = recomputeAll(cases, state.events, interactions, priorTrajectories);

        const note = outcome.result.duplicate
          ? 'The server recognised this as a repeat delivery and did not record it twice.'
          : outcome.result.persisted
            ? 'Recorded by the server and written to the database.'
            : 'Recorded by the server. No database is configured, so it is held in server memory.';

        set({
          cases,
          interactions,
          priorTrajectories,
          ...computed,
          lastInteraction: event,
          lastIngest: {
            at: wallClock(),
            channel: input.channel,
            route: 'server',
            persisted: outcome.result.persisted,
            duplicate: outcome.result.duplicate,
            note,
          },
        });

        get().log(
          'interaction_recorded',
          input.caseId,
          `${input.channel} check-in through the API, completion ${event.completion}`,
        );

        if (event.extractedSignals.crisisFlag) {
          const category = event.extractedSignals.crisisCategory ?? 'unspecified';
          set({ safetyNotice: { caseId: input.caseId, category, at: wallClock() } });
          get().log(
            'safety_override',
            input.caseId,
            `deterministic override, category ${category}; routed for immediate human review`,
          );
        }

        return {
          event,
          route: 'server',
          persisted: outcome.result.persisted,
          duplicate: outcome.result.duplicate,
          note,
        };
      }

      // Fall through to local processing so the answers are never lost.
      const event = get().recordInteraction(input);
      const note = `${outcome.reason} It was scored in this browser and is visible here.`;
      set({
        lastIngest: {
          at: wallClock(),
          channel: input.channel,
          route: 'local',
          persisted: false,
          duplicate: false,
          note,
        },
      });
      return { event, route: 'local', persisted: false, duplicate: false, note };
    }

    const event = get().recordInteraction(input);
    if (event) {
      // Other tabs still see it, which is what makes the counsellor view move
      // during a demo with no server running.
      publishLocalEvent({
        kind: 'interaction_received',
        caseId: input.caseId,
        channel: input.channel,
        at: wallClock(),
        detail: `${input.channel} check-in received`,
      });
    }
    const note =
      state.mode === 'live'
        ? 'The API server is not running, so the check-in was processed in this browser.'
        : 'Demo mode: processed by the real engine in this browser and held for this session.';
    set({
      lastIngest: {
        at: wallClock(),
        channel: input.channel,
        route: 'local',
        persisted: false,
        duplicate: false,
        note,
      },
    });
    return { event, route: 'local', persisted: false, duplicate: false, note };
  },

  signIn: (username, password) => {
    const user = DEMO_USERS.find((u) => u.username === username.trim().toLowerCase());
    if (!user || password !== DEMO_PASSWORD) return { ok: false };
    const session: SessionState = {
      role: user.role,
      displayLabel: user.displayLabel,
      districtId: user.districtId,
      caseId: user.caseId,
      issuedAt: wallClock(),
    };
    writeLocal(STORAGE_KEYS.session, session);
    set({ session });
    get().log('session_started', user.role, 'demo account signed in', user.role);
    return { ok: true, session };
  },

  signOut: () => {
    clearLocal(STORAGE_KEYS.session);
    set({ session: null, ...emptyBundle, assessments: {}, trajectories: {}, baselines: {}, status: 'idle' });
  },

  log: (action, subject, outcome, actorRole = 'system') => {
    const entry: AuditLogEntry = {
      id: nextId('au'),
      at: wallClock(),
      actorRole,
      action,
      subject,
      outcome,
    };
    set((state) => ({ audit: [entry, ...state.audit].slice(0, 200) }));
  },

  init: async () => {
    const session = get().session;
    if (!session) return;
    set({ status: 'loading', error: null });
    try {
      const bundle = await repository.loadCases({
        role: session.role,
        districtId: session.districtId,
        caseId: session.caseId,
      });
      const computed = recomputeAll(
        bundle.cases,
        bundle.events,
        bundle.interactions,
        bundle.priorTrajectories,
      );
      set({
        ...bundle,
        ...computed,
        followUps: seedFollowUps(bundle.cases, computed.assessments),
        actions: [],
        identityRequests: [],
        revealed: {},
        suppressed: {},
        status: 'ready',
      });
      get().log(
        'data_source_selected',
        repository.kind,
        repository.kind === 'demo'
          ? 'deterministic demo dataset in use'
          : 'configured backend in use',
      );
    } catch (error) {
      // The prototype degrades to the deterministic dataset rather than failing.
      console.error('[store] falling back to demo dataset', error);
      const computed = recomputeAll(
        DEMO_SCENARIO.cases,
        DEMO_SCENARIO.events,
        DEMO_SCENARIO.interactions,
        DEMO_SCENARIO.priorTrajectories,
      );
      set({
        cases: DEMO_SCENARIO.cases,
        events: DEMO_SCENARIO.events,
        interactions: DEMO_SCENARIO.interactions,
        priorTrajectories: DEMO_SCENARIO.priorTrajectories,
        ...computed,
        followUps: seedFollowUps(DEMO_SCENARIO.cases, computed.assessments),
        status: 'ready',
        error: 'The configured data source was unavailable, so the demo dataset is in use.',
      });
    }
  },

  recordInteraction: (input) => {
    const state = get();
    const caseRecord = state.cases.find((c) => c.caseId === input.caseId);
    if (!caseRecord) return null;

    const existing = state.interactions.filter((e) => e.caseId === input.caseId);
    const baseline = computeBaseline(input.caseId, existing);

    const event = normalizeInteraction({
      caseId: input.caseId,
      channel: input.channel,
      startedAt: input.startedAt ?? now(),
      completedAt: now(),
      responses: input.responses,
      voice: input.voice,
      skipped: input.skipped ?? 0,
      missedCheckins: caseRecord.missedCheckins,
      baseline,
      baselineVoiceSamples: baselineVoiceSamples(existing),
      passiveAnalysis: caseRecord.consent.passiveAnalysis,
    });

    const interactions = [...state.interactions, event];
    const cases = state.cases.map((c) =>
      c.caseId === input.caseId ? { ...c, lastInteractionAt: event.startedAt } : c,
    );

    // A non-frozen case records its previous score as history, so the
    // trajectory grows by one point per check-in.
    const priorTrajectories = caseRecord.frozen
      ? state.priorTrajectories
      : {
          ...state.priorTrajectories,
          [input.caseId]: [
            ...(state.priorTrajectories[input.caseId] ?? []),
            state.assessments[input.caseId]?.distressScore ??
              (state.priorTrajectories[input.caseId]?.slice(-1)[0] ?? 40),
          ],
        };

    const computed = recomputeAll(cases, state.events, interactions, priorTrajectories);

    set({ cases, interactions, priorTrajectories, ...computed, lastInteraction: event });

    get().log(
      'interaction_recorded',
      input.caseId,
      `${input.channel} check-in, completion ${event.completion}`,
    );

    if (event.extractedSignals.crisisFlag) {
      const category = event.extractedSignals.crisisCategory ?? 'unspecified';
      set({ safetyNotice: { caseId: input.caseId, category, at: wallClock() } });
      get().log(
        'safety_override',
        input.caseId,
        `deterministic override, category ${category}; routed for immediate human review`,
      );
      const cadence: FollowUpCadence = 'within_24h';
      set((s) => ({
        followUps: {
          ...s.followUps,
          [input.caseId]: {
            caseId: input.caseId,
            cadence,
            dueAt: dueAtFor(cadence, wallClock()),
            changedAt: wallClock(),
            changedBy: 'system',
            reason: 'Safety override: explicit crisis statement bypassed scoring.',
          },
        },
      }));
      get().log('followup_changed', input.caseId, 'cadence set to within 24 hours by safety override');
    }

    return event;
  },

  applyCounsellorAction: (input) => {
    const state = get();
    const action: CounsellorAction = {
      id: nextId('ca'),
      caseId: input.caseId,
      kind: input.kind,
      actorRole: input.actorRole,
      at: wallClock(),
      route: input.route,
      note: input.note,
    };

    const assessment = state.assessments[input.caseId];
    const current = state.followUps[input.caseId];
    let cadence = current?.cadence ?? 'monthly';
    let reason = current?.reason ?? '';
    let suppressed = state.suppressed;

    if (input.kind === 'confirmed_concern') {
      cadence = 'within_48h';
      reason = 'Counsellor confirmed the concern after review.';
    } else if (input.kind === 'escalated') {
      cadence = 'within_24h';
      reason = 'Counsellor escalated the case.';
    } else if (input.kind === 'dismissed') {
      cadence = assessment ? cadenceForBand(assessment.band) : 'monthly';
      reason = 'Counsellor reviewed and did not consider this a concern.';
      suppressed = { ...state.suppressed, [input.caseId]: 3 };
    }

    const followUpChanged = cadence !== current?.cadence;

    set({
      actions: [action, ...state.actions],
      suppressed,
      followUps: followUpChanged
        ? {
            ...state.followUps,
            [input.caseId]: {
              caseId: input.caseId,
              cadence,
              dueAt: dueAtFor(cadence, wallClock()),
              changedAt: wallClock(),
              changedBy: input.actorRole,
              reason,
            },
          }
        : state.followUps,
    });

    // The audit log records the action and its route, never the free-text note.
    get().log(
      'counsellor_action',
      input.caseId,
      input.route ? `${input.kind}, route ${input.route}` : input.kind,
      input.actorRole,
    );
    if (followUpChanged) {
      get().log(
        'followup_changed',
        input.caseId,
        `cadence changed to ${cadence}`,
        input.actorRole,
      );
    }
  },

  setPassiveConsent: (caseId, allowed) => {
    const state = get();
    const cases = state.cases.map((c) =>
      c.caseId === caseId
        ? { ...c, consent: { ...c.consent, passiveAnalysis: allowed, updatedAt: wallClock() } }
        : c,
    );

    /**
     * Withdrawal actually deletes the derived features rather than just hiding
     * them: the language, voice and engagement measures taken from this
     * person's interactions are cleared in place. Structured answers and the
     * helpline route remain, which is the graceful degradation the consent
     * notice promises.
     */
    const interactions = allowed
      ? state.interactions
      : state.interactions.map((e) =>
          e.caseId === caseId
            ? {
                ...e,
                voice: undefined,
                responses: e.responses.map(({ freeText: _dropped, ...rest }) => rest),
                extractedSignals: {
                  ...e.extractedSignals,
                  textDistress: null,
                  voiceSignal: null,
                  behaviourDistress: null,
                  compositeRaw: null,
                },
              }
            : e,
        );

    const computed = recomputeAll(cases, state.events, interactions, state.priorTrajectories);
    set({ cases, interactions, ...computed });
    get().log(
      'consent_changed',
      caseId,
      allowed
        ? 'passive analysis permission granted'
        : 'passive analysis permission withdrawn; derived features deleted',
      'victim',
    );
  },

  requestIdentityAccess: (input) => {
    const state = get();
    const identity = DEMO_SCENARIO.identities.find((i) => i.caseId === input.caseId);
    const fields = PURPOSE_FIELDS[input.purpose];
    const expiresAt = new Date(Date.now() + IDENTITY_ACCESS_MINUTES * 60_000).toISOString();

    const request: IdentityAccessRequest = {
      id: nextId('iar'),
      caseId: input.caseId,
      requestedBy: input.actorRole,
      purpose: input.purpose,
      reason: input.reason,
      requestedAt: wallClock(),
      expiresAt,
      revealedFields: fields,
    };

    set({
      identityRequests: [request, ...state.identityRequests],
      revealed: identity
        ? {
            ...state.revealed,
            [input.caseId]: { record: identity, fields, expiresAt, purpose: input.purpose },
          }
        : state.revealed,
    });

    // Purpose code and field list only. The justification text stays on the
    // request record and never enters the audit log.
    get().log(
      'identity_access_requested',
      input.caseId,
      `purpose ${input.purpose}`,
      input.actorRole,
    );
    get().log(
      'identity_access_granted',
      input.caseId,
      `minimum necessary fields ${fields.join(', ')}; expires in ${IDENTITY_ACCESS_MINUTES} minutes`,
      input.actorRole,
    );
  },

  expireIdentityAccess: (caseId) => {
    const state = get();
    if (!state.revealed[caseId]) return;
    const revealed = { ...state.revealed };
    delete revealed[caseId];
    set({ revealed });
    get().log('identity_access_expired', caseId, 'temporary access window closed');
  },

  advanceCheckIn: (caseId) => {
    const state = get();
    const caseRecord = state.cases.find((c) => c.caseId === caseId);
    if (!caseRecord) return;
    const previous = [...state.interactions]
      .filter((e) => e.caseId === caseId && e.isSynthetic)
      .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
      .slice(-1)[0];
    if (!previous) return;

    /**
     * On a frozen case the appended check-in repeats the previous signals
     * exactly, so the prepared scenario advances in time without the score,
     * band, trend or confidence moving. On any other case the signals are
     * nudged in the direction the trend is already going.
     */
    const nudge = caseRecord.frozen
      ? 0
      : state.assessments[caseId]?.trend === 'improving'
        ? -5
        : state.assessments[caseId]?.trend === 'stable'
          ? 0
          : 5;

    const bump = (value: number | null): number | null =>
      value === null ? null : Math.max(0, Math.min(100, value + nudge));

    const appended: InteractionEvent = {
      ...previous,
      id: nextId('ie-adv'),
      startedAt: now(),
      completedAt: now(),
      extractedSignals: {
        ...previous.extractedSignals,
        textDistress: bump(previous.extractedSignals.textDistress),
        behaviourDistress: bump(previous.extractedSignals.behaviourDistress),
        voiceSignal: bump(previous.extractedSignals.voiceSignal),
        compositeRaw: bump(previous.extractedSignals.compositeRaw),
      },
      isSynthetic: true,
    };

    const interactions = [...state.interactions, appended];
    const priorTrajectories = caseRecord.frozen
      ? state.priorTrajectories
      : {
          ...state.priorTrajectories,
          [caseId]: [
            ...(state.priorTrajectories[caseId] ?? []),
            state.assessments[caseId]?.distressScore ?? 40,
          ],
        };
    const cases = state.cases.map((c) =>
      c.caseId === caseId ? { ...c, lastInteractionAt: appended.startedAt } : c,
    );
    const computed = recomputeAll(cases, state.events, interactions, priorTrajectories);
    set({ cases, interactions, priorTrajectories, ...computed });
    get().log(
      'interaction_recorded',
      caseId,
      caseRecord.frozen
        ? 'scripted check-in advanced; frozen case held at its prepared score'
        : 'scripted check-in advanced',
    );
  },

  resetDemo: async () => {
    set({ audit: [], actions: [], identityRequests: [], revealed: {}, suppressed: {}, safetyNotice: null, lastInteraction: null });
    await get().init();
  },

  dismissSafetyNotice: () => set({ safetyNotice: null }),
}));

// ---------------------------------------------------------------------------
// Selectors. Kept outside the store so components subscribe to primitives
// rather than to freshly created objects.
// ---------------------------------------------------------------------------

export interface QueueRow {
  caseRecord: CaseRecord;
  assessment: Assessment;
  followUp: FollowUp | undefined;
  overdueDays: number;
  weight: number;
  suppressed: boolean;
}

export const selectQueue = (state: AppState): QueueRow[] => {
  const rows: QueueRow[] = [];
  for (const caseRecord of state.cases) {
    const assessment = state.assessments[caseRecord.caseId];
    if (!assessment) continue;
    const followUp = state.followUps[caseRecord.caseId];
    const overdueDays = followUp ? daysBetween(followUp.dueAt, DEMO_NOW) : 0;
    rows.push({
      caseRecord,
      assessment,
      followUp,
      overdueDays,
      weight: priorityWeight(assessment, overdueDays),
      suppressed: (state.suppressed[caseRecord.caseId] ?? 0) > 0,
    });
  }
  return rows.sort((a, b) => b.weight - a.weight);
};

export const selectCase = (state: AppState, caseId: string | undefined) =>
  caseId ? state.cases.find((c) => c.caseId === caseId) : undefined;

export const selectCaseEvents = (state: AppState, caseId: string): CaseEvent[] =>
  state.events
    .filter((e) => e.caseId === caseId)
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

export const selectInteractions = (state: AppState, caseId: string): InteractionEvent[] =>
  state.interactions
    .filter((e) => e.caseId === caseId)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));

export const selectActions = (state: AppState, caseId: string): CounsellorAction[] =>
  state.actions.filter((a) => a.caseId === caseId);

export const HERO_ID = HERO_CASE_ID;
export const DEMO_CLOCK = DEMO_NOW;
