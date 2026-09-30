import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CalendarCheck, Home, LifeBuoy, LineChart, LogOut, MessageSquare } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useSessionData } from '@/hooks/useSession';
import { useCapabilities } from '@/hooks/useChannels';
import { ModeSwitch } from './ModeSwitch';
import { Footer } from './Footer';
import { LoadingState } from '@/components/common/Primitives';
import { SafetyNoticeDialog } from '@/components/checkin/SafetyNoticeDialog';
import { cn } from '@/lib/cn';
import type { TranslationKey } from '@/i18n/en';

const NAV: Array<{ to: string; key: TranslationKey; icon: typeof Home; end?: boolean }> = [
  { to: '/victim', key: 'nav.home', icon: Home, end: true },
  { to: '/victim/check-in', key: 'nav.checkIn', icon: MessageSquare },
  { to: '/victim/trend', key: 'nav.trend', icon: LineChart },
  { to: '/victim/case', key: 'nav.caseStatus', icon: CalendarCheck },
  { to: '/victim/support', key: 'nav.support', icon: LifeBuoy },
];

/**
 * The victim surface. Calm, roomy, mobile-first, with navigation that stays in
 * reach at the bottom of a phone screen. No scores, no bands, no queue
 * position is ever shown here.
 */
export const VictimShell = () => {
  const { t, fontClass } = useTranslation();
  const session = useAppStore((s) => s.session);
  const signOut = useAppStore((s) => s.signOut);
  const navigate = useNavigate();
  const { ready, loading } = useSessionData();
  useCapabilities();

  return (
    <div className={cn('min-h-screen bg-ivory-50 pb-24 sm:pb-0', fontClass)}>
      <header className="sticky top-0 z-30 border-b border-line/80 bg-ivory-50/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-5 py-3.5 sm:px-8">
          <div className="min-w-0">
            <p className="eyebrow">{t('app.prototypeBadge')}</p>
            <p className="truncate text-[13px] font-medium text-ink-900">
              {session?.displayLabel ?? ''}
            </p>
          </div>

          <nav className="ml-auto hidden items-center gap-1 sm:flex" aria-label="Main">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'rounded-full px-3.5 py-1.5 text-[13px] transition-colors',
                    isActive
                      ? 'bg-forest-700 text-ivory-50'
                      : 'text-ink-500 hover:bg-ivory-200 hover:text-ink-900',
                  )
                }
              >
                {t(item.key)}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2 sm:ml-0">
            <div className="hidden sm:block">
              <ModeSwitch />
            </div>
            <button
              type="button"
              className="btn-ghost px-3"
              onClick={() => {
                signOut();
                navigate('/login');
              }}
              aria-label={t('nav.signOut')}
            >
              <LogOut aria-hidden className="h-4 w-4" />
              <span className="hidden lg:inline">{t('nav.signOut')}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-12">
        {loading || !ready ? (
          <LoadingState label={t('common.loading')} />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <Outlet />
          </motion.div>
        )}
        <Footer compact />
      </main>

      {/* Phone navigation. Large targets, always visible, no hidden menu. */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 backdrop-blur sm:hidden"
        aria-label="Main"
      >
        <div className="flex">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex flex-1 flex-col items-center gap-1 py-2.5 text-[10.5px] transition-colors',
                  isActive ? 'text-forest-700' : 'text-ink-400',
                )
              }
            >
              <item.icon aria-hidden className="h-[18px] w-[18px]" />
              <span className="px-0.5 text-center leading-tight">{t(item.key)}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      <SafetyNoticeDialog />
    </div>
  );
};
