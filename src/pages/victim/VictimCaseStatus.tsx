import { useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { useAppStore, DEMO_CLOCK } from '@/store/useAppStore';
import { useTranslation } from '@/hooks/useTranslation';
import { CaseJourney } from '@/components/case/CaseJourney';
import { Card, EmptyState, Eyebrow, InlineWarning } from '@/components/common/Primitives';
import { CASE_EVENT_LABELS, CASE_STAGE_LABELS } from '@/engines/constants';
import { formatDate, relativeDays } from '@/lib/format';

/**
 * The person's view of their own case.
 *
 * Plain statements of record with no legal conclusion attached. Where an
 * entitlement looks overdue, the screen says so factually and offers a way to
 * raise it with a human, which is the action that actually helps.
 */
export const VictimCaseStatus = () => {
  const { t } = useTranslation();
  const session = useAppStore((s) => s.session);
  const caseId = session?.caseId;
  const caseRecord = useAppStore((s) => s.cases.find((c) => c.caseId === caseId));
  const events = useAppStore((s) => s.events.filter((e) => e.caseId === caseId));
  const action = useAppStore((s) => s.applyCounsellorAction);
  const [raised, setRaised] = useState(false);

  if (!caseRecord) {
    return (
      <EmptyState
        title="No case is linked to this account"
        body="A case is opened by the district office. Its stages and dates appear here once it exists."
      />
    );
  }

  const sorted = [...events].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  const past = sorted.filter((e) => e.occurredAt <= DEMO_CLOCK);
  const upcoming = sorted.filter((e) => e.occurredAt > DEMO_CLOCK).reverse();
  const overdue = past.find((e) => e.type === 'relief_delayed');

  return (
    <div className="space-y-7">
      <header>
        <Eyebrow>{caseRecord.caseId}</Eyebrow>
        <h1 className="mt-3 text-display-md text-ink-900">{t('nav.caseStatus')}</h1>
        <p className="mt-3 text-[15px] text-ink-500">
          {t('case.stage')}: {CASE_STAGE_LABELS[caseRecord.stage]}
        </p>
      </header>

      <CaseJourney stage={caseRecord.stage} />

      {overdue ? (
        <div className="space-y-3">
          <InlineWarning>{t('case.overdueNote')}</InlineWarning>
          {raised ? (
            <p className="rounded-xl border border-sage-200 bg-sage-100/50 px-4 py-3 text-[13px] text-ink-700">
              {t('case.raised')}
            </p>
          ) : (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                action({
                  caseId: caseRecord.caseId,
                  kind: 'relief_escalation_requested',
                  actorRole: 'victim',
                });
                setRaised(true);
              }}
            >
              {t('case.raiseWithOfficer')}
            </button>
          )}
        </div>
      ) : null}

      {upcoming.length > 0 ? (
        <Card className="border-forest-700/15 bg-forest-700/[0.04]">
          <Eyebrow>{t('case.nextEvent')}</Eyebrow>
          <ul className="mt-3 space-y-2.5">
            {upcoming.map((event) => (
              <li key={event.id} className="flex items-start gap-2.5 text-[14px] text-ink-900">
                <CalendarClock aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-forest-700" />
                <span>
                  {CASE_EVENT_LABELS[event.type]}
                  <span className="ml-2 text-[12.5px] text-ink-400">
                    {formatDate(event.occurredAt)} &middot;{' '}
                    {relativeDays(event.occurredAt, DEMO_CLOCK)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card>
        <Eyebrow>{t('case.recentEvent')}</Eyebrow>
        <ul className="mt-3 divide-y divide-line">
          {past.map((event) => (
            <li key={event.id} className="py-3">
              <p className="text-[14px] text-ink-900">{CASE_EVENT_LABELS[event.type]}</p>
              <p className="mt-0.5 text-[12.5px] text-ink-400">
                {formatDate(event.occurredAt)} &middot; {relativeDays(event.occurredAt, DEMO_CLOCK)}
              </p>
              {event.detail ? (
                <p className="mt-1 text-[13px] leading-relaxed text-ink-500">{event.detail}</p>
              ) : null}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
};
