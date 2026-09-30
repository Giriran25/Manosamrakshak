import { Link } from 'react-router-dom';
import { DEMO_CLOCK } from '@/store/useAppStore';
import { dataSourceLabel } from '@/services/repository';
import { formatDate } from '@/lib/format';

/**
 * The honesty strip. Every screen carries it, so what is simulated and what
 * the scores are for is never more than a glance away.
 */
export const Footer = ({ compact = false }: { compact?: boolean }) => (
  <footer className={compact ? 'mt-10 border-t border-line pt-5' : 'mt-16 border-t border-line pt-8'}>
    <div className="flex flex-col gap-3 text-[11.5px] leading-relaxed text-ink-400 sm:flex-row sm:items-start sm:justify-between">
      <p className="max-w-2xl">
        ManoSamRakshak, AI-Assisted Victim-Support Platform. AI prioritizes attention; a human
        decides the action. Distress signals are walled off from
        relief, compensation and eligibility decisions and from investigative use. No government,
        telecom or clinical integration exists in this build, and every case shown is synthetic.
      </p>
      <div className="flex shrink-0 flex-col gap-1 sm:items-end">
        <span className="chip border-line text-ink-400">{dataSourceLabel()}</span>
        <span>Demo clock: {formatDate(DEMO_CLOCK)}</span>
        <Link to="/about" className="underline decoration-line underline-offset-4 hover:text-ink-700">
          How it works
        </Link>
      </div>
    </div>
  </footer>
);
