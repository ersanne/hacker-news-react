import { useEffect, useState } from 'react';

export type CopyState = 'idle' | 'copied' | 'failed';

export async function copyText(value: string): Promise<CopyState> {
  try { await navigator.clipboard.writeText(value); return 'copied'; }
  catch { return 'failed'; }
}
// The outcome shows in the control that was pressed, then clears itself.
export function useOutcome(): [CopyState, (work: Promise<CopyState>) => void] {
  const [state, setState] = useState<CopyState>('idle');
  useEffect(() => {
    if (state === 'idle') return;
    const timer = setTimeout(() => setState('idle'), 2500);
    return () => clearTimeout(timer);
  }, [state]);
  return [state, work => void work.then(setState)];
}
export function useCopy(): [CopyState, (value: string) => void] {
  const [state, run] = useOutcome();
  return [state, value => run(copyText(value))];
}
