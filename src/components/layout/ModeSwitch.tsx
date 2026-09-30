import { motion } from 'framer-motion';
import type { AppMode } from '@/integrations/channels';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/cn';

const OPTIONS: Array<{ value: AppMode; label: string; detail: string }> = [
  {
    value: 'demo',
    label: 'Demo',
    detail: 'Deterministic seeded cases, fallback channels, the prepared narrative. Safe to present.',
  },
  {
    value: 'live',
    label: 'Live',
    detail:
      'Real channels through the API: server processing, persistence where configured, and the dashboard updating as check-ins arrive.',
  },
];

/**
 * Demo mode or live mode.
 *
 * The distinction matters enough to be permanently visible. Demo mode is the
 * safe presentation path; live mode routes every check-in through the API,
 * persists where a database is configured, and pushes changes to the
 * dashboard. The prepared hero case is protected in both.
 */
export const ModeSwitch = ({ tone = 'light' }: { tone?: 'light' | 'dark' }) => {
  const mode = useAppStore((s) => s.mode);
  const setMode = useAppStore((s) => s.setMode);
  const capabilities = useAppStore((s) => s.capabilities);

  return (
    <div>
      <div
        className={cn(
          'inline-flex items-center gap-1 rounded-full border p-1',
          tone === 'dark' ? 'border-white/15 bg-white/5' : 'border-line bg-paper',
        )}
        role="group"
        aria-label="Application mode"
      >
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setMode(option.value)}
            aria-pressed={mode === option.value}
            className={cn(
              'relative rounded-full px-3 py-1 text-[11.5px] font-medium tracking-wide transition-colors',
              mode === option.value
                ? tone === 'dark'
                  ? 'text-white'
                  : 'text-ivory-50'
                : tone === 'dark'
                  ? 'text-white/55 hover:text-white'
                  : 'text-ink-400 hover:text-ink-900',
            )}
          >
            {mode === option.value ? (
              <motion.span
                layoutId={`mode-pill-${tone}`}
                className={cn(
                  'absolute inset-0 rounded-full',
                  tone === 'dark' ? 'bg-white/20' : 'bg-forest-700',
                )}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              />
            ) : null}
            <span className="relative">{option.label}</span>
          </button>
        ))}
      </div>

      {/* Live mode without a server is a real state and is named as one. */}
      {mode === 'live' && !capabilities.server ? (
        <p
          className={cn(
            'mt-1.5 max-w-[30ch] text-[10.5px] leading-snug',
            tone === 'dark' ? 'text-band-watch' : 'text-band-watch',
          )}
        >
          Live mode selected, but the API server is not reachable. Check-ins are processed in this
          browser.
        </p>
      ) : null}
    </div>
  );
};
