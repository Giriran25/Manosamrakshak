import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronRight, X } from 'lucide-react';
import type { CounsellorAction, EscalationRoute, FollowUp, Recommendation, Role } from '@/types';
import { useAppStore } from '@/store/useAppStore';
import { CADENCE_LABELS, isIntensification } from '@/engines/followup';
import { Eyebrow } from '@/components/common/Primitives';
import { formatTime } from '@/lib/format';
import { cn } from '@/lib/cn';

const EASE = [0.22, 1, 0.36, 1] as const;

const ROUTES: Array<{ value: EscalationRoute; label: string; note: string }> = [
  { value: 'counselling_call', label: 'Counselling call', note: 'Direct contact by the counsellor' },
  { value: 'medical_referral', label: 'Medical referral', note: 'District health facility' },
  {
    value: 'protection_request',
    label: 'Protection request',
    note: 'Protection duty engaged; raised with the nodal officer',
  },
  {
    value: 'relief_escalation',
    label: 'Relief escalation',
    note: 'Outstanding relief raised with the district officer',
  },
  { value: 'legal_aid', label: 'Legal aid', note: 'Referral to legal aid support' },
];

const ACTION_LABELS: Record<CounsellorAction['kind'], string> = {
  reviewed: 'Case reviewed',
  confirmed_concern: 'Concern confirmed',
  dismissed: 'Reviewed, not a concern',
  escalated: 'Escalated',
  counsellor_requested: 'Counsellor requested by the person',
  relief_escalation_requested: 'Relief delay raised by the person',
};

/** The three things that happen when a decision is taken, shown as they happen. */
const CONSEQUENCES: Record<string, string[]> = {
  confirmed_concern: ['Concern confirmed', 'Follow-up tightened', 'Action logged'],
  dismissed: ['Reviewed, not a concern', 'Cadence returned to band default', 'Action logged'],
  escalated: ['Escalation recorded', 'Priority follow-up set', 'Action logged'],
};

const DecisionSequence = ({ kind }: { kind: string }) => {
  const steps = CONSEQUENCES[kind] ?? ['Recorded'];
  return (
    <motion.ol
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.35, ease: EASE }}
      className="overflow-hidden"
    >
      <div className="mt-4 space-y-2 rounded-xl border border-forest-700/20 bg-forest-700/[0.05] px-4 py-3.5">
        {steps.map((step, index) => (
          <motion.li
            key={step}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, delay: index * 0.45, ease: EASE }}
            className="flex items-center gap-2.5 text-[13px] text-ink-900"
          >
            <motion.span
              className="flex h-4 w-4 items-center justify-center rounded-full bg-forest-700 text-white"
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.3, delay: index * 0.45, ease: EASE }}
            >
              <Check aria-hidden className="h-2.5 w-2.5" />
            </motion.span>
            {step}
          </motion.li>
        ))}
      </div>
    </motion.ol>
  );
};

/**
 * Where the decision is taken and recorded.
 *
 * Each control does three things - writes an action against the named role,
 * changes the follow-up cadence, and writes an audit entry - and the panel
 * shows all three happening rather than flashing a toast. The free-text note
 * is stored against the case and deliberately kept out of the audit log.
 */
export const CounsellorActionPanel = ({
  caseId,
  actorRole,
  followUp,
  actions,
  recommendation,
}: {
  caseId: string;
  actorRole: Role;
  followUp: FollowUp | undefined;
  actions: CounsellorAction[];
  recommendation: Recommendation;
}) => {
  const apply = useAppStore((s) => s.applyCounsellorAction);
  const [escalating, setEscalating] = useState(false);
  const [route, setRoute] = useState<EscalationRoute>('counselling_call');
  const [note, setNote] = useState('');
  const [sequence, setSequence] = useState<string | null>(null);
  const [previousCadence, setPreviousCadence] = useState<FollowUp['cadence'] | null>(null);

  useEffect(() => {
    if (!sequence) return;
    const timer = window.setTimeout(() => setSequence(null), 4200);
    return () => window.clearTimeout(timer);
  }, [sequence]);

  const act = (kind: CounsellorAction['kind'], extra?: { route?: EscalationRoute; note?: string }) => {
    setPreviousCadence(followUp?.cadence ?? null);
    apply({ caseId, kind, actorRole, ...extra });
    setSequence(kind);
  };

  const changed = previousCadence && followUp && previousCadence !== followUp.cadence;

  return (
    <div className="space-y-5">
      <div>
        <Eyebrow>Recommended action</Eyebrow>
        <p className="mt-2 font-display text-[23px] leading-tight text-ink-900">
          {recommendation.label}
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-500">{recommendation.rationale}</p>
        <p className="mt-3 border-t border-line pt-3 text-[12px] text-ink-400">
          Proposed for review. The system does not act on its own, and this decision is recorded
          against your role.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary" onClick={() => act('confirmed_concern')}>
          <Check aria-hidden className="h-3.5 w-3.5" />
          Confirm
        </button>
        <button type="button" className="btn-secondary" onClick={() => act('dismissed')}>
          <X aria-hidden className="h-3.5 w-3.5" />
          Dismiss
        </button>
        <button
          type="button"
          className="btn-quiet-danger"
          onClick={() => setEscalating((v) => !v)}
          aria-expanded={escalating}
        >
          Escalate
          <ChevronRight
            aria-hidden
            className={cn('h-3.5 w-3.5 transition-transform', escalating && 'rotate-90')}
          />
        </button>
      </div>

      <AnimatePresence>{sequence ? <DecisionSequence kind={sequence} /> : null}</AnimatePresence>

      <AnimatePresence initial={false}>
        {escalating ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="rounded-2xl border border-line bg-ivory-100/70 px-4 py-4">
              <fieldset>
                <legend className="text-[13px] text-ink-500">Route</legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {ROUTES.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={route === option.value}
                      onClick={() => setRoute(option.value)}
                      className={cn(
                        'rounded-xl border px-3.5 py-2.5 text-left transition-colors',
                        route === option.value
                          ? 'border-forest-700 bg-forest-700/[0.07]'
                          : 'border-line bg-paper hover:border-ink-900/25',
                      )}
                    >
                      <span className="block text-[13px] text-ink-900">{option.label}</span>
                      <span className="mt-0.5 block text-[11.5px] leading-snug text-ink-400">
                        {option.note}
                      </span>
                    </button>
                  ))}
                </div>
              </fieldset>

              <label className="mt-4 block">
                <span className="text-[13px] text-ink-500">
                  Note for the case record (not written to the audit log)
                </span>
                <textarea
                  className="input mt-1.5 min-h-[76px] resize-y bg-paper"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    act('escalated', { route, note: note.trim() || undefined });
                    setEscalating(false);
                    setNote('');
                  }}
                >
                  Record escalation
                </button>
                <button type="button" className="btn-ghost" onClick={() => setEscalating(false)}>
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Adaptive follow-up, shown as a before and after. */}
      <div className="rounded-2xl border border-line bg-paper px-4 py-4">
        <Eyebrow>Follow-up</Eyebrow>
        <div className="mt-2.5 flex flex-wrap items-center gap-3">
          {changed && previousCadence ? (
            <>
              <span className="font-display text-[19px] text-ink-300 line-through">
                {CADENCE_LABELS[previousCadence]}
              </span>
              <motion.span
                aria-hidden
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-ink-300"
              >
                &rarr;
              </motion.span>
            </>
          ) : null}
          <AnimatePresence mode="popLayout">
            <motion.p
              key={followUp?.cadence ?? 'none'}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4, ease: EASE }}
              className="font-display text-[27px] leading-none text-ink-900"
            >
              {followUp ? CADENCE_LABELS[followUp.cadence] : 'Not set'}
            </motion.p>
          </AnimatePresence>
          {changed && previousCadence && followUp && isIntensification(previousCadence, followUp.cadence) ? (
            <motion.span
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="chip border-forest-700/25 bg-forest-700/[0.07] text-forest-700"
            >
              support increased
            </motion.span>
          ) : null}
        </div>
        {followUp ? (
          <p className="mt-2 text-[12.5px] leading-relaxed text-ink-400">{followUp.reason}</p>
        ) : null}
      </div>

      {/* Action log. */}
      <div>
        <Eyebrow>Action log</Eyebrow>
        {actions.length === 0 ? (
          <p className="mt-2 text-[13px] text-ink-400">No action recorded on this case yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            <AnimatePresence initial={false}>
              {actions.map((action) => (
                <motion.li
                  key={action.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.35, ease: EASE }}
                  className="flex flex-wrap items-baseline gap-3 py-2.5 text-[13px]"
                >
                  <span className="font-mono text-[12px] tabular-nums text-ink-300">
                    {formatTime(action.at)}
                  </span>
                  <span className="text-ink-900">{ACTION_LABELS[action.kind]}</span>
                  {action.route ? (
                    <span className="text-[12px] text-ink-400">
                      {ROUTES.find((r) => r.value === action.route)?.label}
                    </span>
                  ) : null}
                  <span className="ml-auto text-[10.5px] uppercase tracking-[0.12em] text-ink-300">
                    {action.actorRole}
                  </span>
                  {action.note ? (
                    <p className="w-full text-[11.5px] leading-relaxed text-ink-400">
                      Note on the case record: {action.note}
                    </p>
                  ) : null}
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </div>
  );
};
