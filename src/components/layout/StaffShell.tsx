import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BarChart3,
  FileClock,
  Info,
  LayoutList,
  ListFilter,
  Lock,
  LogOut,
  Radio,
  ShieldCheck,
  SlidersHorizontal,
  Timer,
} from 'lucide-react';
import type { Role } from '@/types';
import { useAppStore } from '@/store/useAppStore';
import { useSessionData } from '@/hooks/useSession';
import { useTranslation } from '@/hooks/useTranslation';
import { useCapabilities, useLiveFeed } from '@/hooks/useChannels';
import { Footer } from './Footer';
import { DemoControls } from './DemoControls';
import { ModeSwitch } from './ModeSwitch';
import { LoadingState } from '@/components/common/Primitives';
import { cn } from '@/lib/cn';

const EASE = [0.22, 1, 0.36, 1] as const;

interface NavItem {
  to: string;
  label: string;
  icon: typeof BarChart3;
  end?: boolean;
}

const COUNSELLOR_NAV: NavItem[] = [
  { to: '/counsellor', label: 'Overview', icon: BarChart3, end: true },
  { to: '/counsellor/queue', label: 'Priority queue', icon: ListFilter },
  { to: '/counsellor/cases', label: 'Cases', icon: LayoutList },
  { to: '/counsellor/followups', label: 'Follow-ups', icon: Timer },
  { to: '/admin/channels', label: 'Channels', icon: Radio },
];

const ADMIN_NAV: NavItem[] = [
  { to: '/admin/identity', label: 'Identity', icon: ShieldCheck },
  { to: '/admin/audit', label: 'Audit', icon: FileClock },
  { to: '/admin/channels', label: 'Channels', icon: Radio },
  { to: '/admin/privacy', label: 'Privacy', icon: Lock },
  { to: '/admin/system', label: 'System', icon: SlidersHorizontal },
];

const navFor = (role: Role): NavItem[] => (role === 'admin' ? ADMIN_NAV : COUNSELLOR_NAV);

/**
 * The staff surface.
 *
 * Denser than the victim portal, on a dark rail, with tabular figures and one
 * place for the presenter controls so nobody is hunting for them mid-demo. The
 * two roles get different navigation because they are doing different jobs:
 * a counsellor works a queue, an administrator holds custody of identity.
 */
export const StaffShell = () => {
  const session = useAppStore((s) => s.session);
  const signOut = useAppStore((s) => s.signOut);
  const navigate = useNavigate();
  const { ready, loading, error } = useSessionData();
  const { fontClass } = useTranslation();
  // Ask the API what it can do, then stay subscribed to live activity for as
  // long as a staff screen is open.
  useCapabilities();
  useLiveFeed();
  const location = useLocation();

  const role = session?.role ?? 'counsellor';
  const nav = navFor(role);

  return (
    <div className={cn('flex min-h-screen bg-ivory-50', fontClass)}>
      <aside className="hidden w-[248px] shrink-0 flex-col justify-between bg-forest-900 px-5 py-6 text-ivory-50 lg:flex">
        <div>
          <p className="text-[10.5px] uppercase tracking-[0.2em] text-white/40">ManoSamRakshak</p>
          <p className="mt-1.5 font-display text-[17px] leading-tight text-white">
            AI-Assisted Victim-Support Platform
          </p>
          <p className="mt-1 text-[11px] text-white/45">AI prioritizes attention; a human decides the action.</p>

          <nav className="mt-9 space-y-1" aria-label="Staff">
            {nav.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end}>
                {({ isActive }) => (
                  <span
                    className={cn(
                      'relative flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] transition-colors',
                      isActive
                        ? 'text-white'
                        : 'text-white/55 hover:bg-white/[0.06] hover:text-white',
                    )}
                  >
                    {isActive ? (
                      <motion.span
                        layoutId="staff-nav-active"
                        className="absolute inset-0 rounded-xl bg-white/[0.13]"
                        transition={{ duration: 0.35, ease: EASE }}
                      />
                    ) : null}
                    <item.icon aria-hidden className="relative h-4 w-4" />
                    <span className="relative">{item.label}</span>
                  </span>
                )}
              </NavLink>
            ))}

            <NavLink
              to="/about"
              className={({ isActive }) =>
                cn(
                  'mt-2 flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] transition-colors',
                  isActive ? 'bg-white/[0.13] text-white' : 'text-white/45 hover:text-white',
                )
              }
            >
              <Info aria-hidden className="h-4 w-4" />
              How it works
            </NavLink>
          </nav>

          <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-3">
            <p className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.14em] text-white/40">
              <SlidersHorizontal aria-hidden className="h-3 w-3" />
              Demo controls
            </p>
            <DemoControls tone="dark" />
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-2xl bg-white/[0.04] px-3.5 py-3 text-[11.5px] leading-relaxed text-white/55">
            The system proposes. A named human decides, and is recorded as having decided.
          </div>
          <ModeSwitch tone="dark" />
          <p className="truncate text-[11.5px] text-white/50">{session?.displayLabel}</p>
          <button
            type="button"
            className="btn w-full justify-start gap-2 border border-white/12 px-3 text-[13px] text-white/70 hover:bg-white/[0.07] hover:text-white"
            onClick={() => {
              signOut();
              navigate('/login');
            }}
          >
            <LogOut aria-hidden className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Compact rail for tablet and phone, where the sidebar is hidden. */}
        <header className="sticky top-0 z-30 border-b border-line bg-ivory-50/90 backdrop-blur lg:hidden">
          <div className="flex items-center gap-3 px-4 py-3">
            <p className="font-display text-[15px] text-ink-900">ManoSamRakshak</p>
            <div className="ml-auto flex items-center gap-1.5">
              <ModeSwitch />
              <button
                type="button"
                className="btn-ghost px-2"
                aria-label="Sign out"
                onClick={() => {
                  signOut();
                  navigate('/login');
                }}
              >
                <LogOut aria-hidden className="h-4 w-4" />
              </button>
            </div>
          </div>
          <nav
            className="flex items-center gap-1 overflow-x-auto px-4 pb-2.5 no-scrollbar"
            aria-label="Staff"
          >
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'whitespace-nowrap rounded-full px-3 py-1.5 text-[12.5px] transition-colors',
                    isActive
                      ? 'bg-forest-700 text-ivory-50'
                      : 'border border-line bg-paper text-ink-500',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </header>

        <main className="mx-auto w-full max-w-[1420px] flex-1 px-4 py-6 sm:px-7 sm:py-9">
          {error ? (
            <div className="mb-5 rounded-xl border border-band-watch/30 bg-band-watch/10 px-4 py-3 text-[13px] text-ink-700">
              {error}
            </div>
          ) : null}
          <div className="mb-5 lg:hidden">
            <DemoControls tone="light" />
          </div>

          {loading || !ready ? (
            <LoadingState label="Loading cases" />
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: EASE }}
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          )}
          <Footer compact />
        </main>
      </div>
    </div>
  );
};
