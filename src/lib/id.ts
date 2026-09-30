let counter = 0;

/**
 * Monotonic, human-readable ids for live records. Demo records carry explicit
 * ids instead, so nothing in the seeded scenario depends on this counter.
 */
export const nextId = (prefix: string): string => {
  counter += 1;
  return `${prefix}-${counter.toString().padStart(4, '0')}`;
};

export const resetIdCounter = (): void => {
  counter = 0;
};
