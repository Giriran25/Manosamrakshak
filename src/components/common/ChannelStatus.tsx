import { motion } from 'framer-motion';
import { CircleDot, Loader2, PlugZap, Radio, TriangleAlert, Unplug } from 'lucide-react';
import type { Channel } from '@/types';
import { resolveChannelStatus, STATE_TONE, type ChannelState } from '@/integrations/channels';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/cn';

const ICONS: Record<ChannelState, typeof Radio> = {
  real: Radio,
  connected: PlugZap,
  processing: Loader2,
  fallback: CircleDot,
  unavailable: Unplug,
  error: TriangleAlert,
};

/**
 * The channel badge.
 *
 * One component decides what every channel screen claims about itself, reading
 * the mode, the server's reported capabilities and what this browser can
 * actually do. A fallback is never dressed up as a live connection: the badge
 * says which it is and the sentence underneath says why.
 */
export const ChannelStatus = ({
  channel,
  processing = false,
  className,
  withDetail = true,
}: {
  channel: Channel;
  processing?: boolean;
  className?: string;
  withDetail?: boolean;
}) => {
  const mode = useAppStore((s) => s.mode);
  const capabilities = useAppStore((s) => s.capabilities);
  const client = useAppStore((s) => s.client);

  const resolved = resolveChannelStatus(channel, mode, capabilities, client);
  const state: ChannelState = processing ? 'processing' : resolved.state;
  const Icon = ICONS[state];

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <motion.span
        layout
        className={cn('chip uppercase tracking-[0.12em]', STATE_TONE[state])}
      >
        <Icon aria-hidden className={cn('h-3 w-3', state === 'processing' && 'animate-spin')} />
        {processing ? 'Processing' : resolved.label}
      </motion.span>
      {withDetail ? (
        <p className="max-w-[68ch] text-[12px] leading-relaxed text-ink-400">{resolved.detail}</p>
      ) : null}
    </div>
  );
};

/** Compact one-line summary of all four channels. Used on the test panel. */
export const ChannelStatusRow = () => {
  const mode = useAppStore((s) => s.mode);
  const capabilities = useAppStore((s) => s.capabilities);
  const client = useAppStore((s) => s.client);
  const channels: Channel[] = ['chat', 'voice', 'sms', 'ivrs'];

  return (
    <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {channels.map((channel) => {
        const resolved = resolveChannelStatus(channel, mode, capabilities, client);
        const Icon = ICONS[resolved.state];
        return (
          <li key={channel} className="rounded-2xl border border-line bg-paper px-4 py-3.5">
            <p className="eyebrow capitalize">{channel}</p>
            <p className="mt-2">
              <span className={cn('chip uppercase tracking-[0.12em]', STATE_TONE[resolved.state])}>
                <Icon aria-hidden className="h-3 w-3" />
                {resolved.label}
              </span>
            </p>
            <p className="mt-2 text-[11.5px] leading-relaxed text-ink-400">{resolved.detail}</p>
          </li>
        );
      })}
    </ul>
  );
};
