import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FastForward, RotateCcw, Target } from 'lucide-react';
import { HERO_ID, useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/cn';

/**
 * Presenter controls.
 *
 * NEXT CHECK-IN advances the selected case by one scripted step. On the hero
 * case that step repeats the previous signals exactly, so the prepared
 * scenario moves forward in time while the score, band, trend and confidence
 * stay where they were prepared. Nothing performed live in a channel
 * simulator can disturb it.
 */
export const DemoControls = ({ tone }: { tone: 'light' | 'dark' }) => {
  const advance = useAppStore((s) => s.advanceCheckIn);
  const reset = useAppStore((s) => s.resetDemo);
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);

  const button = cn(
    'flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12px] transition-colors',
    tone === 'dark'
      ? 'text-white/70 hover:bg-white/10 hover:text-white'
      : 'border border-line bg-paper text-ink-600 hover:bg-ivory-100',
  );

  return (
    <div className={cn('mt-2 space-y-1.5', tone === 'light' && 'flex flex-wrap gap-2 space-y-0')}>
      <button
        type="button"
        className={cn(button, tone === 'light' && 'w-auto')}
        onClick={() => navigate(`/counsellor/case/${HERO_ID}`)}
      >
        <Target aria-hidden className="h-3.5 w-3.5" />
        Load demo case
      </button>
      <button
        type="button"
        className={cn(button, tone === 'light' && 'w-auto')}
        onClick={() => advance(HERO_ID)}
      >
        <FastForward aria-hidden className="h-3.5 w-3.5" />
        Next check-in
      </button>
      {confirming ? (
        <div className={cn('flex gap-1.5', tone === 'light' && 'w-auto')}>
          <button
            type="button"
            className={cn(button, 'w-auto')}
            onClick={() => {
              void reset();
              setConfirming(false);
            }}
          >
            Confirm reset
          </button>
          <button type="button" className={cn(button, 'w-auto')} onClick={() => setConfirming(false)}>
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          className={cn(button, tone === 'light' && 'w-auto')}
          onClick={() => setConfirming(true)}
        >
          <RotateCcw aria-hidden className="h-3.5 w-3.5" />
          Reset demo
        </button>
      )}
    </div>
  );
};
