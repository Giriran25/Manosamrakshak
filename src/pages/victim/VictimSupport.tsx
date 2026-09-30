import { useState } from 'react';
import { PhoneCall, ShieldCheck } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { useTranslation } from '@/hooks/useTranslation';
import { Card, EmptyState, Eyebrow, PrototypeNote } from '@/components/common/Primitives';
import { RETENTION_COPY } from '@/data/policy';

/**
 * Support, and the consent control.
 *
 * Withdrawing permission genuinely deletes the measures taken from this
 * person's check-ins rather than hiding them: the language, voice and
 * engagement features are cleared and the score falls back to the streams that
 * remain. The check-in and the helpline are untouched, which is what graceful
 * degradation has to mean here.
 */
export const VictimSupport = () => {
  const { t } = useTranslation();
  const session = useAppStore((s) => s.session);
  const caseId = session?.caseId;
  const caseRecord = useAppStore((s) => s.cases.find((c) => c.caseId === caseId));
  const setConsent = useAppStore((s) => s.setPassiveConsent);
  const action = useAppStore((s) => s.applyCounsellorAction);
  const [requested, setRequested] = useState(false);

  if (!caseRecord || !caseId) {
    return (
      <EmptyState
        title="No case is linked to this account"
        body="Support options are attached to a case. The helpline number below works regardless."
      />
    );
  }

  const allowed = caseRecord.consent.passiveAnalysis;

  return (
    <div className="space-y-7">
      <header>
        <Eyebrow>{t('support.title')}</Eyebrow>
        <h1 className="mt-3 max-w-[24ch] text-display-md text-ink-900">
          You can ask for support at any time.
        </h1>
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <Eyebrow>{t('support.requestCounsellor')}</Eyebrow>
          <p className="mt-2 text-[14.5px] leading-relaxed text-ink-500">
            Your district counsellor will see the request at their next review. You do not need to
            give a reason.
          </p>
          {requested ? (
            <p className="mt-4 rounded-xl border border-sage-200 bg-sage-100/50 px-4 py-3 text-[13px] text-ink-700">
              {t('support.requested')}
            </p>
          ) : (
            <button
              type="button"
              className="btn-primary mt-4"
              onClick={() => {
                action({ caseId, kind: 'counsellor_requested', actorRole: 'victim' });
                setRequested(true);
              }}
            >
              <PhoneCall aria-hidden className="h-3.5 w-3.5" />
              {t('support.requestCounsellor')}
            </button>
          )}
        </Card>

        <Card>
          <Eyebrow>{t('support.helpline')}</Eyebrow>
          <p className="mt-2 font-display text-[32px] leading-none text-ink-900">14566</p>
          <p className="mt-3 text-[13.5px] leading-relaxed text-ink-500">
            The national helpline for victims of atrocities. This prototype does not place calls; the
            number is shown so it is never more than one screen away.
          </p>
        </Card>
      </div>

      <Card>
        <Eyebrow>{t('support.consent')}</Eyebrow>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="min-w-0 flex-1">
            <p className="text-[14.5px] leading-relaxed text-ink-900">
              {t('support.consentPassive')}
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-500">
              {allowed
                ? 'Currently allowed. Your check-ins are read for changes over time so your support team can see when something shifts.'
                : t('support.withdrawn')}
            </p>
          </div>
          <button
            type="button"
            className={allowed ? 'btn-quiet-danger shrink-0' : 'btn-primary shrink-0'}
            onClick={() => setConsent(caseId, !allowed)}
          >
            {allowed ? t('support.withdraw') : t('support.restore')}
          </button>
        </div>
        <PrototypeNote>
          Withdrawal takes effect immediately and deletes the measures already taken from your
          check-ins. Your check-ins and the helpline continue to work.
        </PrototypeNote>
      </Card>

      <Card>
        <Eyebrow>{t('support.dataNote')}</Eyebrow>
        <ul className="mt-3 space-y-2.5 text-[13.5px] leading-relaxed text-ink-500">
          {[
            'Your case is identified by a reference, not by your name. Your name, address and phone number are held separately from anything that is analysed.',
            'A recording is analysed on your own device and then deleted. Only summary measures are kept.',
            'Only your district support team can see your case. Every time someone looks up your identity, that is recorded with a stated reason.',
            'Your check-ins are never used to decide relief, compensation or eligibility, and are not shared for investigation.',
            RETENTION_COPY,
            'You can withdraw the permission above at any time.',
          ].map((line) => (
            <li key={line} className="flex items-start gap-2.5">
              <ShieldCheck aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-sage-500" />
              {line}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
};
