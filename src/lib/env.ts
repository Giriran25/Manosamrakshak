/**
 * The only place client configuration is read.
 *
 * Anything compiled into the browser bundle is public, so only these two
 * values are ever exposed. Server-only secrets (a Supabase service-role key, a
 * session secret, an encryption key) must never be given a VITE_ prefix and
 * are not read anywhere in src/. scripts/check-integrity.mjs fails the build
 * if they appear.
 */

const FORBIDDEN_PATTERN = /(SERVICE_ROLE|SECRET|ENCRYPTION_KEY|PRIVATE_KEY|PASSWORD)/i;

export interface PublicConfig {
  supabaseUrl: string | null;
  supabaseAnonKey: string | null;
  hasSupabase: boolean;
}

const read = (key: string): string | null => {
  const value = (import.meta.env as Record<string, string | undefined>)[key];
  return value && value.trim().length > 0 ? value.trim() : null;
};

/**
 * Development guard. If a server-only secret has been given a VITE_ prefix by
 * mistake it would be silently shipped to every browser, so fail loudly the
 * first time the app boots instead.
 */
export const assertNoClientSecrets = (): void => {
  if (!import.meta.env.DEV) return;
  const offenders = Object.keys(import.meta.env).filter(
    (key) => key.startsWith('VITE_') && FORBIDDEN_PATTERN.test(key),
  );
  if (offenders.length > 0) {
    throw new Error(
      `Refusing to start: server-only secret names exposed to the client bundle: ${offenders.join(', ')}. Remove the VITE_ prefix and move them to server environment configuration.`,
    );
  }
};

export const publicConfig: PublicConfig = (() => {
  const supabaseUrl = read('VITE_SUPABASE_URL');
  const supabaseAnonKey = read('VITE_SUPABASE_ANON_KEY');
  return {
    supabaseUrl,
    supabaseAnonKey,
    hasSupabase: Boolean(supabaseUrl && supabaseAnonKey),
  };
})();
