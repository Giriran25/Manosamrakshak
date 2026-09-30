import { useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';

/**
 * Capability discovery.
 *
 * Asks the API what it can do once per mount and re-asks when the mode
 * changes, so a server started mid-demo is picked up without a reload. A
 * missing server is a normal answer, not an error.
 */
export const useCapabilities = (): void => {
  const refresh = useAppStore((s) => s.refreshCapabilities);
  const mode = useAppStore((s) => s.mode);

  useEffect(() => {
    void refresh();
  }, [refresh, mode]);
};

/** Subscribes the current screen to live activity for as long as it is mounted. */
export const useLiveFeed = (): void => {
  const start = useAppStore((s) => s.startLiveFeed);
  const serverPresent = useAppStore((s) => s.capabilities.server);

  useEffect(() => {
    const stop = start();
    return stop;
    // Re-subscribe when the server appears or disappears, since that decides
    // whether the feed comes from server-sent events or from a cross-tab
    // broadcast.
  }, [start, serverPresent]);
};
