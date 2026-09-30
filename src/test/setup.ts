/**
 * Test environment shims. jsdom implements neither matchMedia, nor the
 * ResizeObserver the charting library relies on, nor the IntersectionObserver
 * behind the scroll reveals, so the rendering smoke tests provide minimal
 * stand-ins. All three exist in every browser the prototype targets.
 */
if (typeof window !== 'undefined') {
  window.scrollTo = (() => undefined) as typeof window.scrollTo;

  const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
  HTMLElement.prototype.getBoundingClientRect = function () {
    const rect = originalGetBoundingClientRect.call(this);
    if (rect.width > 0 && rect.height > 0) return rect;
    return DOMRect.fromRect({ x: 0, y: 0, width: 320, height: 180 });
  };

  if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  }

  if (!('ResizeObserver' in window)) {
    class StubResizeObserver {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    (window as unknown as { ResizeObserver: unknown }).ResizeObserver = StubResizeObserver;
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = StubResizeObserver;
  }

  if (!('IntersectionObserver' in window)) {
    class StubIntersectionObserver {
      readonly root = null;
      readonly rootMargin = '';
      readonly thresholds: number[] = [];
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
      takeRecords(): [] {
        return [];
      }
    }
    (window as unknown as { IntersectionObserver: unknown }).IntersectionObserver =
      StubIntersectionObserver;
    (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver =
      StubIntersectionObserver;
  }
}
