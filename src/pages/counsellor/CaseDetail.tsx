import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import {
  selectActions,
  selectCaseEvents,
  selectInteractions,
  useAppStore,
  DEMO_CLOCK,
} from '@/store/useAppStore';
import { CASE_STAGE_LABELS } from '@/engines/constants';
import { CONTRIBUTION_LABELS, CONTRIBUTION_STREAMS } from '@/engines/fusion';
import { TREND_DESCRIPTIONS } from '@/engines/trend';
import { TrajectoryChart } from '@/components/charts/TrajectoryChart';
import { CaseTimeline } from '@/components/case/CaseTimeline';
import { CounsellorActionPanel } from '@/components/case/CounsellorActionPanel';
import { SignalConvergence } from '@/components/risk/SignalConvergence';
import {
  ConfidenceChip,
  ConfidencePanel,
  RiskBadge,
  SafetyChip,
  SignalBreakdown,
  TrendBadge,
  WhyFlaggedCard,
} from '@/components/risk/RiskPrimitives';
import { EmptyState, Eyebrow } from '@/components/common/Primitives';
import { DisclosureSection, Rise } from '@/components/common/Editorial';
import { useCountUp } from '@/hooks/useCountUp';
import { CHANNEL_LABELS } from '@/engines/normalize';
import { relativeDays, signed } from '@/lib/format';
import { ETHICAL_FIREWALL } from '@/data/policy';

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * The case detail screen.
 *
 * Read top to bottom it is the whole argument: what the number is, what this
 * person's own normal looks like, how far they have moved from it, what the
 * case did to them while that happened, why the system says what it says, how
 * certain it is, what it proposes - and then, last, who decides.
 *
 * Sections disclose as they are reached rather than arriving all at once,
 * because the order is the reasoning.
 */
export const CaseDetail = () => {
  const { caseId = '' } = useParams();
  const session = useAppStore((s) => s.session);
  const caseRecord = useAppStore((s) => s.cases.find((c) => c.caseId === caseId));
  const assessment = useAppStore((s) => s.assessments[caseId]);
  const trajectory = useAppStore((s) => s.trajectories[caseId]);
  const baseline = useAppStore((s) => s.baselines[caseId]);
  const followUp = useAppStore((s) => s.followUps[caseId]);
  const events = useAppStore((s) => selectCaseEvents(s, caseId));
  const interactions = useAppStore((s) => selectInteractions(s, caseId));
  const actions = useAppStore((s) => selectActions(s, caseId));

  const score = useCountUp(assessment?.distressScore ?? 0, 1100);

  if (!caseRecord || !assessment) {
    return (
      <div className="space-y-5">
        <Link
          to="/counsellor/queue"
          className="inline-flex items-center gap-1.5 text-[13px] text-ink-500 hover:text-ink-900"
        >
          <ArrowLeft aria-hidden className="h-3.5 w-3.5" />
          Back to the queue
        </Link>
        <EmptyState
          title="Case not available to this role"
          body="Access is scoped to the district on your account, and out-of-district cases are not loaded at all. If this case belongs to another district, it cannot be opened here."
        />
      </div>
    );
  }

  const channelsUsed = Array.from(new Set(interactions.map((e) => e.channel)));
  const interactionDates = [...interactions]
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    .map((e) => e.startedAt);

  return (
    <div className="space-y-12 pb-4">
      <Link
        to="/counsellor/queue"
        className="inline-flex items-center gap-1.5 text-[13px] text-ink-500 transition-colors hover:text-ink-900"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" />
        Back to the queue
      </Link>

      {/*
        Hero. The number is set large because it is what a counsellor came for,
        and the caption underneath says what it is and is not in the same
        breath.
      */}
      <header className="grid gap-8 lg:grid-cols-[1fr_0.9fr] lg:items-end">
        <div>
          <Eyebrow>Case</Eyebrow>
          <h1 className="mt-2 font-mono text-display-md tracking-tight text-ink-900">
            {caseRecord.caseId}
          </h1>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {assessment.safetyOverride ? <SafetyChip /> : null}
            <RiskBadge band={assessment.band} score={assessment.distressScore} />
            <TrendBadge trend={assessment.trend} />
            <ConfidenceChip
              band={assessment.confidence.band}
              value={assessment.confidence.overall}
            />
            <span className="chip border-line text-ink-500">
              {CASE_STAGE_LABELS[caseRecord.stage]}
            </span>
            {caseRecord.isSynthetic ? (
              <span className="chip border-lav-200 bg-lav-200/25 text-lav-500">
                Synthetic demo case
              </span>
            ) : null}
            {caseRecord.frozen ? (
              <span className="chip border-line text-ink-400">scripted, held</span>
            ) : null}
          </div>

          <p className="mt-3.5 text-[12.5px] text-ink-400">
            Last check-in{' '}
            {caseRecord.lastInteractionAt
              ? relativeDays(caseRecord.lastInteractionAt, DEMO_CLOCK)
              : 'not yet'}{' '}
            &middot; channels used:{' '}
            {channelsUsed.map((c) => CHANNEL_LABELS[c]).join(', ') || 'none'} &middot;{' '}
            {interactions.length} check-in{interactions.length === 1 ? '' : 's'} on record
          </p>
        </div>

        {/* The four numbers, as one block rather than four floating tiles. */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="overflow-hidden rounded-3xl border border-line bg-paper"
        >
          <div className="flex items-end gap-5 px-5 py-5 sm:px-6">
            <div>
              <p className="eyebrow">Current signal</p>
              <p className="mt-1 font-display text-[62px] leading-none tabular-nums text-ink-900">
                {score}
              </p>
            </div>
            <p className="mb-2 max-w-[22ch] text-[11.5px] leading-relaxed text-ink-400">
              Prototype support-priority signal, 0 to 100. A triage number for ordering a queue, not
              a diagnosis.
            </p>
          </div>
          <dl className="grid grid-cols-3 divide-x divide-line border-t border-line">
            {[
              ['Baseline', assessment.baseline ?? '—'],
              [
                'Deviation',
                assessment.deviation === null ? '—' : signed(assessment.deviation),
              ],
              ['Confidence', `${assessment.confidence.overall}%`],
            ].map(([label, value]) => (
              <div key={label} className="px-4 py-3.5">
                <dt className="text-[10px] uppercase tracking-[0.12em] text-ink-400">{label}</dt>
                <dd className="mt-1 font-mono text-[19px] tabular-nums text-ink-900">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="border-t border-line bg-ivory-100/60 px-5 py-2.5 text-[11.5px] text-ink-400">
            Baseline is the median of this person&rsquo;s first three check-ins. The comparison is
            always within-person.
          </p>
        </motion.div>
      </header>

      {/* 01 Trajectory */}
      <DisclosureSection
        index="01"
        label="Trajectory"
        title="How this person has moved away from their own baseline"
        description={`${TREND_DESCRIPTIONS[assessment.trend]} Slope ${assessment.slope.toFixed(1)} points per check-in across ${assessment.persistence} consecutive rise${assessment.persistence === 1 ? '' : 's'}.`}
      >
        <div className="rounded-3xl border border-line bg-paper px-4 py-5 sm:px-6">
          <TrajectoryChart
            trajectory={trajectory ?? []}
            assessment={assessment}
            events={events}
            interactionDates={interactionDates}
          />
        </div>
      </DisclosureSection>

      {/* 02 Case journey */}
      <DisclosureSection
        index="02"
        label="Case journey"
        title="What the case was doing in the same period"
        description="Stream A. The heaviest input in the model, and the only one a district officer can act on directly."
      >
        <div className="rounded-3xl border border-line bg-paper px-5 py-6 sm:px-7">
          <CaseTimeline events={events} stage={caseRecord.stage} />
        </div>
      </DisclosureSection>

      {/* 03 Signals */}
      <DisclosureSection
        index="03"
        label="Signals"
        title="Four readings, weighted into one"
        description="Stroke weight is the stream's effective weight; bar length is its reading. Unavailable streams have their weight redistributed across the rest, so the breakdown always accounts for the whole score."
      >
        <div className="space-y-4">
          <div className="rounded-3xl border border-line bg-paper px-4 py-6 sm:px-7">
            <SignalConvergence assessment={assessment} />
          </div>
          <div className="rounded-3xl border border-line bg-paper px-5 py-5 sm:px-6">
            <SignalBreakdown
              assessment={assessment}
              labels={CONTRIBUTION_LABELS}
              streams={CONTRIBUTION_STREAMS}
            />
          </div>
        </div>
      </DisclosureSection>

      {/* 04 Why flagged */}
      <DisclosureSection
        index="04"
        label="Explanation"
        title="Why this case is moving up the queue."
        description="Ranked by how much each factor actually contributed. Every number below is one the engine computed."
      >
        <div className="rounded-3xl border border-line bg-paper px-5 py-5 sm:px-6">
          <WhyFlaggedCard assessment={assessment} />
        </div>
      </DisclosureSection>

      {/* 05 Confidence */}
      <DisclosureSection
        index="05"
        label="Confidence"
        title="How much evidence this rests on"
      >
        <div className="grid gap-4 lg:grid-cols-[1fr_0.85fr]">
          <div className="rounded-3xl border border-line bg-paper px-5 py-5 sm:px-6">
            <ConfidencePanel assessment={assessment} />
          </div>
          <div className="rounded-3xl border border-line bg-ivory-100/60 px-5 py-5">
            <Eyebrow>What confidence is not</Eyebrow>
            <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink-600">
              Confidence reflects the amount and the agreement of the available evidence. It does
              not mean the system is always correct, and it is not a probability that the person is
              unwell.
            </p>
            <p className="mt-3 text-[13.5px] leading-relaxed text-ink-600">
              Its job is narrow and important: high concern resting on thin evidence is routed to
              human review instead of being fired as an alert, so a counsellor&rsquo;s attention is
              not spent on cases the system cannot actually support.
            </p>
            {baseline?.status !== 'established' ? (
              <p className="mt-3 rounded-xl bg-paper px-4 py-3 text-[12.5px] leading-relaxed text-ink-500">
                This person&rsquo;s baseline is still being established
                {baseline ? ` (${baseline.interactionsUsed} of 3 check-ins)` : ''}, so the
                within-person comparison is unavailable and confidence is held down accordingly.
              </p>
            ) : null}
          </div>
        </div>
      </DisclosureSection>

      {/* 06 Decision */}
      <DisclosureSection
        index="06"
        label="Decision"
        title="What happens next, and who decides it"
      >
        <div className="grid gap-4 lg:grid-cols-[1fr_0.85fr]">
          <div
            className={`rounded-3xl border px-5 py-5 sm:px-6 ${
              assessment.recommendation.kind === 'human_review_required'
                ? 'border-band-watch/30 bg-band-watch/[0.06]'
                : assessment.safetyOverride
                  ? 'border-band-high/30 bg-band-high/[0.06]'
                  : 'border-forest-700/20 bg-forest-700/[0.04]'
            }`}
          >
            <CounsellorActionPanel
              caseId={caseRecord.caseId}
              actorRole={session?.role ?? 'counsellor'}
              followUp={followUp}
              actions={actions}
              recommendation={assessment.recommendation}
            />
          </div>

          <div className="space-y-4">
            {caseRecord.notes ? (
              <div className="rounded-3xl border border-line bg-paper px-5 py-5">
                <Eyebrow>Case note</Eyebrow>
                <p className="mt-2 text-[13.5px] leading-relaxed text-ink-600">
                  {caseRecord.notes}
                </p>
              </div>
            ) : null}

            <div className="rounded-3xl border border-line bg-ivory-100/60 px-5 py-5">
              <Eyebrow>Ethical firewall</Eyebrow>
              <p className="mt-2 text-[12.5px] leading-relaxed text-ink-500">
                {ETHICAL_FIREWALL} This assessment is a triage signal, not a clinical diagnosis, and
                it is not used for relief, compensation or eligibility decisions.
              </p>
            </div>
          </div>
        </div>
      </DisclosureSection>

      <Rise>
        <p className="border-t border-line pt-5 text-[11.5px] leading-relaxed text-ink-400">
          Prototype heuristic weights, not clinically validated and not calibrated against outcome
          data. Every case in this build is synthetic.
        </p>
      </Rise>
    </div>
  );
};
