import { useMemo, useState } from 'react';
import type { AuditActionType } from '@/types';
import { useAppStore } from '@/store/useAppStore';
import { Card, EmptyState, Eyebrow, PrototypeNote } from '@/components/common/Primitives';
import { formatTime } from '@/lib/format';
import { cn } from '@/lib/cn';

const ACTION_LABELS: Record<AuditActionType, string> = {
  session_started: 'Session started',
  safety_override: 'Safety override',
  counsellor_action: 'Counsellor action',
  followup_changed: 'Follow-up changed',
  identity_access_requested: 'Identity access requested',
  identity_access_granted: 'Identity access granted',
  identity_access_expired: 'Identity access expired',
  consent_changed: 'Consent changed',
  interaction_recorded: 'Interaction recorded',
  data_source_selected: 'Data source selected',
};

/**
 * The audit log.
 *
 * Deliberately dull, and deliberately thin: time, role, action type, subject
 * reference and outcome. No names, no free text, no transcripts, no audio, no
 * scores attached to a person's words. If a row here leaked it would tell a
 * reader what was done, not anything about the person it was done for.
 */
export const AdminAudit = () => {
  const audit = useAppStore((s) => s.audit);
  const [filter, setFilter] = useState<AuditActionType | 'all'>('all');

  const rows = useMemo(
    () => (filter === 'all' ? audit : audit.filter((entry) => entry.action === filter)),
    [audit, filter],
  );

  const present = useMemo(
    () => Array.from(new Set(audit.map((entry) => entry.action))),
    [audit],
  );

  return (
    <div className="space-y-6">
      <header>
        <Eyebrow>Audit</Eyebrow>
        <h1 className="mt-2 text-display-md text-ink-900">Every sensitive action, recorded</h1>
        <p className="mt-3 max-w-[70ch] text-[14.5px] leading-relaxed text-ink-500">
          Written as the action happens, in this session, from the moment a role signs in. Identity
          releases, safety overrides, counsellor decisions, follow-up changes and consent changes
          all land here.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setFilter('all')}
          aria-pressed={filter === 'all'}
          className={cn(
            'btn text-[12.5px]',
            filter === 'all'
              ? 'bg-forest-700 text-ivory-50'
              : 'border border-line bg-paper text-ink-600 hover:bg-ivory-100',
          )}
        >
          All ({audit.length})
        </button>
        {present.map((action) => (
          <button
            key={action}
            type="button"
            onClick={() => setFilter(action)}
            aria-pressed={filter === action}
            className={cn(
              'btn text-[12.5px]',
              filter === action
                ? 'bg-forest-700 text-ivory-50'
                : 'border border-line bg-paper text-ink-600 hover:bg-ivory-100',
            )}
          >
            {ACTION_LABELS[action]}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="Nothing recorded yet"
          body="Sign in, complete a check-in, take a counsellor action or request identity access, and the entries appear here."
        />
      ) : (
        <Card className="p-0 sm:p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <caption className="sr-only">Audit log for this session</caption>
              <thead className="table-head">
                <tr>
                  {['Time', 'Actor role', 'Action', 'Subject', 'Outcome'].map((heading) => (
                    <th key={heading} scope="col" className="px-4 py-3 font-medium">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((entry) => (
                  <tr key={entry.id} className="border-b border-line/60 last:border-0">
                    <td className="px-4 py-2.5 font-mono text-[12px] tabular-nums text-ink-400">
                      {formatTime(entry.at)}
                    </td>
                    <td className="px-4 py-2.5 text-[12.5px] uppercase tracking-[0.1em] text-ink-500">
                      {entry.actorRole}
                    </td>
                    <td className="px-4 py-2.5 text-[13px] text-ink-900">
                      <span
                        className={cn(
                          entry.action === 'safety_override' && 'text-band-high',
                          entry.action.startsWith('identity') && 'text-lav-500',
                        )}
                      >
                        {ACTION_LABELS[entry.action]}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[12.5px] text-ink-600">
                      {entry.subject}
                    </td>
                    <td className="px-4 py-2.5 text-[12.5px] leading-relaxed text-ink-500">
                      {entry.outcome}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <PrototypeNote>
        The log holds no names, no addresses, no contact numbers, no free text from a check-in, no
        transcripts and no audio. A safety override records its category, never the sentence that
        triggered it.
      </PrototypeNote>
    </div>
  );
};
