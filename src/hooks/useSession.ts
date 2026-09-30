import { useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';

/**
 * Loads the case bundle once a session exists. Every screen behind the login
 * calls this, so a reload lands on populated data rather than an empty shell.
 */
export const useSessionData = (): { ready: boolean; loading: boolean; error: string | null } => {
  const session = useAppStore((s) => s.session);
  const status = useAppStore((s) => s.status);
  const error = useAppStore((s) => s.error);
  const init = useAppStore((s) => s.init);

  useEffect(() => {
    if (session && status === 'idle') void init();
  }, [session, status, init]);

  return { ready: status === 'ready', loading: status === 'loading', error };
};
