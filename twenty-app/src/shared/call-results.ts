// What happened on the phone line, filled in automatically
// (separate from the Outcome the rep picks by hand).
export const CALL_RESULTS = [
  { value: 'IN_PROGRESS', label: 'In progress', color: 'gray' },
  { value: 'CONNECTED', label: 'Connected', color: 'green' },
  { value: 'NO_ANSWER', label: 'No answer', color: 'sky' },
  { value: 'BUSY', label: 'Busy', color: 'orange' },
  { value: 'FAILED', label: 'Failed', color: 'red' },
  { value: 'REP_MISSED', label: 'Rep didn\'t pick up', color: 'yellow' },
  { value: 'CANCELED', label: 'Canceled', color: 'gray' },
] as const;

export type CallResultValue = (typeof CALL_RESULTS)[number]['value'];

// Turns our internal "why did it end" code into the Call result shown in Twenty.
export const callResultForEndReason = (
  endReason: string | null | undefined,
  wasConnected: boolean,
): CallResultValue => {
  if (wasConnected) return 'CONNECTED';
  switch (endReason) {
    case 'prospect-busy':
      return 'BUSY';
    case 'prospect-no-answer':
      return 'NO_ANSWER';
    case 'prospect-failed':
      return 'FAILED';
    case 'prospect-canceled':
    case 'hung-up':
      return 'CANCELED';
    default:
      return endReason?.startsWith('rep-') ? 'REP_MISSED' : 'CANCELED';
  }
};
