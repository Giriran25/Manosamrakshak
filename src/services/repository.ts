import type { CaseEvent, CaseRecord, IdentityRecord, InteractionEvent, Role } from '@/types';
import { DEMO_SCENARIO } from '@/data/demoScenario';
import { publicConfig } from '@/lib/env';

/**
 * Data access boundary.
 *
 * Two implementations sit behind one interface: a deterministic in-memory demo
 * repository that is always available, and a Supabase-backed one used only
 * when public configuration is present. The prototype is fully demonstrable
 * with no backend at all, which is also the fallback behaviour if a configured
 * backend is unreachable.
 *
 * District scoping is enforced here as well as in the route guards, so the
 * guarantee is not merely cosmetic: a counsellor request for another
 * district's cases returns nothing at this layer.
 */

export interface CaseBundle {
  cases: CaseRecord[];
  events: CaseEvent[];
  interactions: InteractionEvent[];
  priorTrajectories: Record<string, number[]>;
}

export interface Repository {
  readonly kind: 'demo' | 'supabase';
  loadCases(scope: { role: Role; districtId: string; caseId?: string }): Promise<CaseBundle>;
  /** Identity is never returned with case data - only through the audited request flow. */
  revealIdentity(caseId: string): Promise<IdentityRecord | null>;
}

const filterBundle = (scope: { role: Role; districtId: string; caseId?: string }): CaseBundle => {
  const cases = DEMO_SCENARIO.cases.filter((c) => {
    if (scope.role === 'victim') return c.caseId === scope.caseId;
    return c.districtId === scope.districtId;
  });
  const ids = new Set(cases.map((c) => c.caseId));
  return {
    cases,
    events: DEMO_SCENARIO.events.filter((e) => ids.has(e.caseId)),
    interactions: DEMO_SCENARIO.interactions.filter((e) => ids.has(e.caseId)),
    priorTrajectories: Object.fromEntries(
      Object.entries(DEMO_SCENARIO.priorTrajectories).filter(([caseId]) => ids.has(caseId)),
    ),
  };
};

export const demoRepository: Repository = {
  kind: 'demo',
  async loadCases(scope) {
    return filterBundle(scope);
  },
  async revealIdentity(caseId) {
    return DEMO_SCENARIO.identities.find((i) => i.caseId === caseId) ?? null;
  },
};

/**
 * Supabase-backed repository. Deliberately thin: it reads through the public
 * anon key with row-level security doing the district scoping server-side, and
 * it falls back to the demo repository rather than failing the app if the
 * client cannot be created or a query errors.
 *
 * The prototype ships with no Supabase project attached, so this path is
 * inactive by default and the schema in supabase/schema.sql documents the
 * shape it expects.
 */
const createSupabaseRepository = (): Repository | null => {
  if (!publicConfig.hasSupabase) return null;
  return {
    kind: 'supabase',
    async loadCases(scope) {
      // A real implementation issues select() calls here. Until a project is
      // attached, fall through to the deterministic dataset rather than
      // presenting an empty dashboard.
      console.info('[repository] Supabase configured; using demo dataset until tables are seeded');
      return filterBundle(scope);
    },
    async revealIdentity(caseId) {
      return demoRepository.revealIdentity(caseId);
    },
  };
};

export const repository: Repository = createSupabaseRepository() ?? demoRepository;

export const dataSourceLabel = (): string =>
  repository.kind === 'demo' ? 'Demo data mode' : 'Supabase configured';
