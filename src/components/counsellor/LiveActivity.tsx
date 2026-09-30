import { AnimatePresence, motion } from 'framer-motion';
import { Activity } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { formatTime } from '@/lib/format';
import { cn } from '@/lib/cn';

const TONE: Record<string, string> = {
  interaction_received: 'bg-teal-500',
  signals_extracted: 'bg-stream-engagement',
  assessment_updated: 'bg-lav-400',
  review_recommended: 'bg-band-elevated',
  safety_override: 'bg-band-high',
  call_state: 'bg-stream-case',
};

/**
 * Live activity.
 *
 * Fed by server-sent events when the API is running and by a cross-tab
 * broadcast otherwise, so a check-in taken on a victim's screen shows here
 * without a refresh. Only the case reference and the stage reached travel over
 * this channel: nothing a person wrote or said appears in it.
 */
export const LiveActivity = () => {
  const events = useAppStore((s) => s.liveEvents);
  const server = useAppStore((s) => s.capabilities.server);
  const mode = useAppStore((s) => s.mode);

  return (
    <div className="rounded-3xl border border-line bg-paper px-5 py-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="eyebrow flex items-center gap-1.5">
          <Activity aria-hidden className="h-3 w-3" />
          Live activity
        </p>
        <span
          className={cn(
            'chip',
            server
              ? 'border-teal-500/30 bg-teal-500/10 text-teal-600'
              : 'border-line bg-ivory-100 text-ink-400',
          )}
        >
          <span
            aria-hidden
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              server ? 'animate-pulse-soft bg-teal-500' : 'bg-ink-300',
            )}
          />
          {server ? 'streaming from the API' : 'this browser only'}
        </span>
      </div>

      {events.length === 0 ? (
        <p className="mt-3 text-[12.5px] leading-relaxed text-ink-400">
          {mode === 'live'
            ? 'Nothing yet. Complete a check-in on the victim portal and it will appear here as it is processed.'
            : 'Demo mode. Switch to live mode, or complete a check-in in another tab, to see activity arrive here.'}
        </p>
      ) : (
        <ul className="mt-3 space-y-2" aria-live="polite">
          <AnimatePresence initial={false}>
            {events.slice(0, 8).map((event, index) => (
              <motion.li
                key={`${event.at}-${event.kind}-${index}`}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="flex items-baseline gap-2.5 text-[12.5px]"
              >
                <span className="font-mono tabular-nums text-ink-300">{formatTime(event.at)}</span>
                <span
                  aria-hidden
                  className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', TONE[event.kind] ?? 'bg-ink-300')}
                />
                <span className="min-w-0 flex-1 text-ink-700">{event.detail}</span>
                <span className="font-mono text-[11px] text-ink-400">{event.caseId}</span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
};
