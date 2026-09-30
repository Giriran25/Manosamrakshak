import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Clock, Eye, KeyRound, Lock } from 'lucide-react';
import type { IdentityPurpose, IdentityRecord } from '@/types';
import { PURPOSE_LABELS, useAppStore } from '@/store/useAppStore';
import { Eyebrow, EmptyState, PrototypeNote } from '@/components/common/Primitives';
import { DisclosureSection, Rise } from '@/components/common/Editorial';
import { IDENTITY_ACCESS_MINUTES } from '@/data/policy';
import { formatTime } from '@/lib/format';
import { cn } from '@/lib/cn';

const EASE = [0.22, 1, 0.36, 1] as const;

type Field = keyof Omit<IdentityRecord, 'caseId'>;

const PURPOSES: IdentityPurpose[] = [
  'counselling_outreach',
  'protection_request',
  'relief_escalation',
  'medical_referral',
];

/** Which fields each purpose actually needs. Shown to the requester up front. */
const PURPOSE_FIELDS: Record<IdentityPurpose, Field[]> = {
  counselling_outreach: ['name', 'contact'],
  protection_request: ['name', 'location'],
  relief_escalation: ['name', 'location'],
  medical_referral: ['name', 'contact'],
};

const FIELD_LABELS: Record<Field, string> = {
  name: 'Name',
  location: 'Location',
  contact: 'Contact',
};

/** Minimum necessary means partial: enough to make contact, not a full record. */
const mask = (field: Field, value: string): string => {
  if (field === 'contact') {
    const digits = value.replace(/\D/g, '');
    return `+91 XXXXX ${digits.slice(-4)}`;
  }
  if (field === 'name') {
    const parts = value.split(' ');
    return parts
      .map((part, index) =>
        index === parts.length - 1 && parts.length > 1
          ? `${part[0] ?? ''}.`
          : `${part[0] ?? ''}${'*'.repeat(Math.max(0, part.length - 1))}`,
      )
      .join(' ');
  }
  const [first, ...rest] = value.split(',');
  return rest.length > 0 ? `${first}, ${'*'.repeat(6)}` : `${first.slice(0, 4)}${'*'.repeat(6)}`;
};

/** Countdown ring around the remaining access window. */
const AccessTimer = ({ secondsLeft, total }: { secondsLeft: number; total: number }) => {
  const radius = 13;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(1, secondsLeft / total));
  return (
    <span className="inline-flex items-center gap-2">
      <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden>
        <circle cx="16" cy="16" r={radius} fill="none" stroke="#E4EAE7" strokeWidth="2.5" />
        <circle
          cx="16"
          cy="16"
          r={radius}
          fill="none"
          stroke="#2E8474"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
          transform="rotate(-90 16 16)"
        />
      </svg>
      <span className="font-mono text-[12px] tabular-nums text-teal-600">
        {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
      </span>
    </span>
  );
};

/**
 * Identity custody.
 *
 * Identity is not stored on the case and is not returned with case data. It
 * lives in a separate vault and is released field by field, against a stated
 * purpose and a written justification, for a fixed window, with the release
 * recorded. Everything a counsellor sees in the queue works without any of it.
 *
 * This is a demonstration of the workflow, not a real government
 * authorization system, and the screen says so throughout.
 */
export const AdminIdentity = () => {
  const cases = useAppStore((s) => s.cases);
  const revealed = useAppStore((s) => s.revealed);
  const requests = useAppStore((s) => s.identityRequests);
  const request = useAppStore((s) => s.requestIdentityAccess);
  const expire = useAppStore((s) => s.expireIdentityAccess);

  const [openFor, setOpenFor] = useState<string | null>(null);
  const [purpose, setPurpose] = useState<IdentityPurpose>('counselling_outreach');
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [tick, setTick] = useState(0);

  // Drives the countdown and the automatic re-mask when a window closes.
  useEffect(() => {
    const timer = window.setInterval(() => setTick((v) => v + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const nowMs = Date.now();
    for (const [caseId, entry] of Object.entries(revealed)) {
      if (new Date(entry.expiresAt).getTime() <= nowMs) expire(caseId);
    }
  }, [tick, revealed, expire]);

  const named = useMemo(() => cases.filter((c) => !c.caseId.startsWith('VC-11')), [cases]);
  const valid = reason.trim().length >= 20 && confirmed;

  if (cases.length === 0) {
    return (
      <EmptyState
        title="No cases loaded"
        body="Identity records are attached to cases in this district."
      />
    );
  }

  return (
    <div className="space-y-11 pb-4">
      <header>
        <Rise>
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip border-lav-200 bg-lav-200/25 uppercase tracking-[0.14em] text-lav-500">
              Policy simulation
            </span>
            <p className="text-[12px] text-ink-400">
              A demonstration of a minimum-necessary disclosure workflow. Not a real government
              authorization system.
            </p>
          </div>
        </Rise>
        <Rise delay={0.06}>
          <h1 className="mt-4 max-w-[24ch] text-display-md text-ink-900">
            Identity is held apart from everything that is analysed.
          </h1>
          <p className="mt-3 max-w-[70ch] text-[15px] leading-relaxed text-ink-500">
            The queue, the trajectories and the scores all work from a case reference alone. A name,
            an address or a phone number is released only against a stated purpose and a written
            justification, only the fields that purpose needs, and only for{' '}
            {IDENTITY_ACCESS_MINUTES} minutes.
          </p>
        </Rise>
      </header>

      {/* What each purpose is permitted to see. */}
      <DisclosureSection
        index="01"
        label="Minimum necessary"
        title="Each purpose sees only what it needs"
      >
        <div className="overflow-hidden rounded-3xl border border-line bg-paper">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left">
              <caption className="sr-only">Fields released for each stated purpose</caption>
              <thead>
                <tr className="border-b border-line">
                  <th
                    scope="col"
                    className="px-5 py-3 text-[10.5px] font-medium uppercase tracking-[0.12em] text-ink-400"
                  >
                    Purpose
                  </th>
                  {(['name', 'location', 'contact'] as Field[]).map((field) => (
                    <th
                      key={field}
                      scope="col"
                      className="px-5 py-3 text-[10.5px] font-medium uppercase tracking-[0.12em] text-ink-400"
                    >
                      {FIELD_LABELS[field]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PURPOSES.map((entry) => (
                  <tr key={entry} className="border-b border-line/60 last:border-0">
                    <td className="px-5 py-3 text-[13.5px] text-ink-900">
                      {PURPOSE_LABELS[entry]}
                    </td>
                    {(['name', 'location', 'contact'] as Field[]).map((field) => {
                      const granted = PURPOSE_FIELDS[entry].includes(field);
                      return (
                        <td key={field} className="px-5 py-3">
                          <span
                            className={cn(
                              'chip',
                              granted
                                ? 'border-teal-500/30 bg-teal-500/10 text-teal-600'
                                : 'border-line text-ink-300',
                            )}
                          >
                            {granted ? 'released, masked' : 'withheld'}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </DisclosureSection>

      {/* The vault. */}
      <DisclosureSection index="02" label="Vault" title="Cases in this district">
        <div className="grid gap-4 lg:grid-cols-2">
          {named.map((caseRecord) => {
            const entry = revealed[caseRecord.caseId];
            const secondsLeft = entry
              ? Math.max(0, Math.round((new Date(entry.expiresAt).getTime() - Date.now()) / 1000))
              : 0;

            return (
              <motion.article
                key={caseRecord.caseId}
                layout
                className={cn(
                  'rounded-3xl border px-5 py-5 transition-colors',
                  entry ? 'border-teal-500/30 bg-teal-500/[0.04]' : 'border-line bg-paper',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Eyebrow>Case reference</Eyebrow>
                    <p className="mt-1 font-mono text-[18px] text-ink-900">{caseRecord.caseId}</p>
                  </div>
                  {entry ? (
                    <AccessTimer secondsLeft={secondsLeft} total={IDENTITY_ACCESS_MINUTES * 60} />
                  ) : (
                    <span className="chip border-line text-ink-400">
                      <Lock aria-hidden className="h-3 w-3" />
                      protected
                    </span>
                  )}
                </div>

                <dl className="mt-4 divide-y divide-line/70">
                  {(['name', 'location', 'contact'] as Field[]).map((field) => {
                    const granted = entry?.fields.includes(field);
                    return (
                      <div key={field} className="flex items-baseline justify-between gap-3 py-2">
                        <dt className="text-[12.5px] text-ink-400">{FIELD_LABELS[field]}</dt>
                        <dd>
                          <AnimatePresence mode="wait">
                            <motion.span
                              key={granted ? 'open' : 'closed'}
                              initial={{ opacity: 0, y: 4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -4 }}
                              transition={{ duration: 0.28, ease: EASE }}
                              className={cn(
                                'block text-[13.5px]',
                                granted ? 'font-mono text-ink-900' : 'text-ink-300',
                              )}
                            >
                              {granted && entry ? mask(field, entry.record[field]) : 'Protected'}
                            </motion.span>
                          </AnimatePresence>
                        </dd>
                      </div>
                    );
                  })}
                </dl>

                {entry ? (
                  <p className="mt-3 rounded-xl bg-paper px-3.5 py-2.5 text-[11.5px] leading-relaxed text-ink-500">
                    Released for {PURPOSE_LABELS[entry.purpose]}. Only the fields that purpose
                    requires were released, in partial form, and they re-mask automatically when the
                    window closes.
                  </p>
                ) : null}

                <button
                  type="button"
                  className="btn-secondary mt-4"
                  onClick={() => {
                    setOpenFor(caseRecord.caseId);
                    setReason('');
                    setConfirmed(false);
                    setPurpose('counselling_outreach');
                  }}
                >
                  <KeyRound aria-hidden className="h-3.5 w-3.5" />
                  Request identity access
                </button>
              </motion.article>
            );
          })}
        </div>
      </DisclosureSection>

      {requests.length > 0 ? (
        <DisclosureSection index="03" label="Requests" title="Made in this session">
          <div className="rounded-3xl border border-line bg-paper px-5 py-5">
            <ul className="divide-y divide-line">
              {requests.map((entry) => (
                <li key={entry.id} className="py-3">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[13px]">
                    <span className="font-mono text-ink-900">{entry.caseId}</span>
                    <span className="text-ink-600">{PURPOSE_LABELS[entry.purpose]}</span>
                    <span className="text-[11.5px] text-ink-400">
                      fields: {entry.revealedFields.map((f) => FIELD_LABELS[f]).join(', ')}
                    </span>
                    <span className="ml-auto font-mono text-[11.5px] text-ink-300">
                      {formatTime(entry.requestedAt)}
                    </span>
                  </div>
                  <p className="mt-1 text-[12px] leading-relaxed text-ink-400">
                    Justification held on the request record: &ldquo;{entry.reason}&rdquo;
                  </p>
                </li>
              ))}
            </ul>
            <PrototypeNote>
              The audit log stores the purpose code and the field list only. The justification text
              stays here, on the request record, and never enters the log.
            </PrototypeNote>
          </div>
        </DisclosureSection>
      ) : null}

      {/* Request dialog. */}
      <AnimatePresence>
        {openFor ? (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center bg-forest-900/45 px-4 pb-6 backdrop-blur-sm sm:items-center sm:pb-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="identity-dialog-title"
          >
            <motion.div
              className="w-full max-w-lg rounded-3xl border border-line bg-paper p-6 shadow-lift"
              initial={{ y: 20, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 14, opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.32, ease: EASE }}
            >
              <div className="flex items-center gap-2">
                <span className="chip border-lav-200 bg-lav-200/25 uppercase tracking-[0.14em] text-lav-500">
                  Policy simulation
                </span>
                <span className="font-mono text-[12.5px] text-ink-400">{openFor}</span>
              </div>
              <h2 id="identity-dialog-title" className="mt-3 text-display-sm text-ink-900">
                Request identity access
              </h2>

              <fieldset className="mt-5">
                <legend className="text-[13px] text-ink-500">Purpose</legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {PURPOSES.map((option) => (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={purpose === option}
                      onClick={() => setPurpose(option)}
                      className={cn(
                        'rounded-xl border px-3.5 py-2.5 text-left transition-colors',
                        purpose === option
                          ? 'border-forest-700 bg-forest-700/[0.06]'
                          : 'border-line bg-paper hover:border-ink-900/25',
                      )}
                    >
                      <span className="block text-[13px] text-ink-900">
                        {PURPOSE_LABELS[option]}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-ink-400">
                        {PURPOSE_FIELDS[option].map((f) => FIELD_LABELS[f]).join(' + ')}
                      </span>
                    </button>
                  ))}
                </div>
              </fieldset>

              <label className="mt-4 block">
                <span className="text-[13px] text-ink-500">
                  Reason for access (at least 20 characters)
                </span>
                <textarea
                  className="input mt-1.5 min-h-[84px] resize-y"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
                <span className="mt-1 block text-[11.5px] text-ink-400">
                  {reason.trim().length} / 20
                </span>
              </label>

              <label className="mt-3 flex items-start gap-2.5 text-[12.5px] leading-relaxed text-ink-600">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-line accent-forest-700"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                I confirm this access is necessary for the stated purpose, that I will use only the
                fields released, and that this request is recorded.
              </label>

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-primary"
                  disabled={!valid}
                  onClick={() => {
                    request({
                      caseId: openFor,
                      purpose,
                      reason: reason.trim(),
                      actorRole: 'admin',
                    });
                    setOpenFor(null);
                  }}
                >
                  <Eye aria-hidden className="h-3.5 w-3.5" />
                  Release minimum necessary
                </button>
                <button type="button" className="btn-ghost" onClick={() => setOpenFor(null)}>
                  Cancel
                </button>
                <span className="ml-auto inline-flex items-center gap-1.5 text-[11.5px] text-ink-400">
                  <Clock aria-hidden className="h-3 w-3" />
                  expires in {IDENTITY_ACCESS_MINUTES} minutes
                </span>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};
