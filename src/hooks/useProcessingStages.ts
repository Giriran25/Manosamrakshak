import { useEffect, useState } from 'react';

/**
 * What happens between submitting a check-in and being answered.
 *
 * Two named stages rather than one spinner: the person sees that they were
 * heard, and then that the check-in is being read as a signal. It is honest
 * about the order of operations and it gives the moment a little weight.
 */
export type ProcessingStage = 'listening' | 'analysing' | 'done';

export const useProcessingStages = (key: string): ProcessingStage => {
  const [stage, setStage] = useState<ProcessingStage>('listening');

  useEffect(() => {
    setStage('listening');
    const toAnalysing = window.setTimeout(() => setStage('analysing'), 950);
    const toDone = window.setTimeout(() => setStage('done'), 2050);
    return () => {
      window.clearTimeout(toAnalysing);
      window.clearTimeout(toDone);
    };
  }, [key]);

  return stage;
};
