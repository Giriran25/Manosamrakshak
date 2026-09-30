import { useEffect, useState } from 'react';

/**
 * Reads a media query in a way that is safe when matchMedia is missing or
 * throws, which is the case in some embedded webviews and in test
 * environments. The fallback is always the mobile answer, so a layout degrades
 * to the simpler arrangement rather than to a broken one.
 */
export const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    let list: MediaQueryList;
    try {
      list = window.matchMedia(query);
    } catch {
      return;
    }
    setMatches(list.matches);
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    if (typeof list.addEventListener === 'function') {
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    }
    return undefined;
  }, [query]);

  return matches;
};
