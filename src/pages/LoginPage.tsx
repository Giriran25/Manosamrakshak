import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Lock } from 'lucide-react';
import type { Role } from '@/types';
import { useAppStore } from '@/store/useAppStore';
import { useTranslation } from '@/hooks/useTranslation';
import { DEMO_PASSWORD, DEMO_USERS } from '@/data/demoScenario';
import { cn } from '@/lib/cn';
import type { TranslationKey } from '@/i18n/en';

const ROLE_KEYS: Record<Role, TranslationKey> = {
  victim: 'login.roleVictim',
  counsellor: 'login.roleCounsellor',
  admin: 'login.roleAdmin',
};

const LANDING_FOR: Record<Role, string> = {
  victim: '/victim',
  counsellor: '/counsellor',
  admin: '/admin/identity',
};

export const LoginPage = () => {
  const { t, fontClass } = useTranslation();
  const signIn = useAppStore((s) => s.signIn);
  const navigate = useNavigate();

  const [role, setRole] = useState<Role>('counsellor');
  const [username, setUsername] = useState('counsellor');
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [error, setError] = useState<string | null>(null);

  const pickRole = (next: Role) => {
    setRole(next);
    setUsername(next);
    setError(null);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const result = signIn(username, password);
    if (!result.ok || !result.session) {
      setError(t('login.error'));
      return;
    }
    navigate(LANDING_FOR[result.session.role]);
  };

  return (
    <div className={cn('flex min-h-screen flex-col bg-ivory-50 lg:flex-row', fontClass)}>
      {/* Editorial panel. Carries the argument, not a stock illustration. */}
      <div className="relative flex flex-col justify-between overflow-hidden bg-forest-900 px-6 py-8 text-ivory-50 sm:px-10 lg:w-[46%] lg:py-12">
        <div aria-hidden className="grain pointer-events-none absolute inset-0 opacity-40" />
        <div className="relative flex items-center gap-3">
          <Link to="/" className="text-[10.5px] uppercase tracking-[0.2em] text-white/50">
            ManoSamRakshak
          </Link>
          <span className="text-white/20">/</span>
          <span className="text-[10.5px] uppercase tracking-[0.2em] text-white/35">Victim support</span>
        </div>

        <motion.div
          className="relative mt-12 lg:mt-0"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <h1 className="max-w-[16ch] font-display text-display-lg text-white">
            Know who needs attention.
          </h1>
          <p className="mt-6 max-w-[46ch] text-[15.5px] leading-relaxed text-white/60">
            Track change over time. Understand case context. Keep the human in control.
          </p>
        </motion.div>

        <p className="relative mt-12 max-w-[52ch] text-[11.5px] leading-relaxed text-white/40 lg:mt-0">
          A triage aid for district counsellors, not a diagnostic instrument. Distress signals are
          never used for relief, compensation or eligibility decisions. All cases in this build are
          synthetic.
        </p>
      </div>

      <div className="flex flex-1 items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-[420px]">
          <div className="mb-8 flex items-center justify-between gap-4">
            <div>
              <p className="eyebrow">{t('app.prototypeBadge')}</p>
              <h2 className="mt-2 text-display-sm text-ink-900">{t('login.title')}</h2>
            </div>
          </div>

          <p className="text-[13.5px] leading-relaxed text-ink-500">{t('login.subtitle')}</p>

          <form onSubmit={submit} className="mt-6 space-y-5">
            <fieldset>
              <legend className="text-[13px] text-ink-500">{t('login.role')}</legend>
              <div className="mt-2 grid gap-2">
                {(['victim', 'counsellor', 'admin'] as Role[]).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => pickRole(option)}
                    aria-pressed={role === option}
                    className={cn(
                      'rounded-xl border px-4 py-3 text-left text-[14px] transition-all duration-200',
                      role === option
                        ? 'border-forest-700 bg-forest-700/[0.06] text-ink-900'
                        : 'border-line bg-paper text-ink-600 hover:border-ink-900/25',
                    )}
                  >
                    {t(ROLE_KEYS[option])}
                  </button>
                ))}
              </div>
            </fieldset>

            <label className="block">
              <span className="text-[13px] text-ink-500">{t('login.username')}</span>
              <input
                className="input mt-1.5"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
              />
            </label>

            <label className="block">
              <span className="text-[13px] text-ink-500">{t('login.password')}</span>
              <input
                className="input mt-1.5"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </label>

            {error ? (
              <p role="alert" className="text-[13px] text-band-high">
                {error}
              </p>
            ) : null}

            <button type="submit" className="btn-primary w-full py-3">
              {t('login.signIn')}
              <ArrowRight aria-hidden className="h-4 w-4" />
            </button>
          </form>

          <div className="mt-7 rounded-xl border border-line bg-ivory-100/70 px-4 py-4">
            <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] text-ink-400">
              <Lock aria-hidden className="h-3 w-3" />
              {t('login.demoCredentials')}
            </p>
            <ul className="mt-2.5 space-y-1 font-mono text-[12px] text-ink-600">
              {DEMO_USERS.map((user) => (
                <li key={user.username}>
                  {user.username} / {DEMO_PASSWORD}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11.5px] leading-relaxed text-ink-400">{t('login.demoNote')}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
