// The ten call outcomes reps pick from after a call.
// `value` is what's stored in Twenty; `label` is what people see.
export const CALL_OUTCOMES = [
  { value: 'CONNECTED', label: 'Connected', color: 'turquoise' },
  { value: 'VOICEMAIL', label: 'Voicemail', color: 'jade' },
  { value: 'DNC', label: 'DNC', color: 'gray' },
  { value: 'BUSY', label: 'Busy', color: 'orange' },
  { value: 'NO_ANSWER', label: 'No Answer', color: 'sky' },
  { value: 'RECEPTIONIST', label: 'Receptionist', color: 'mint' },
  { value: 'HIGH_INTEREST', label: 'High Interest', color: 'green' },
  { value: 'LOW_INTEREST', label: 'Low Interest', color: 'yellow' },
  { value: 'HARD_NO', label: 'Hard No', color: 'red' },
  { value: 'WRONG_NUMBER', label: 'Wrong Number', color: 'blue' },
] as const;

export type CallOutcomeValue = (typeof CALL_OUTCOMES)[number]['value'];

export const isCallOutcome = (value: unknown): value is CallOutcomeValue =>
  CALL_OUTCOMES.some((outcome) => outcome.value === value);

export const outcomeLabel = (value: CallOutcomeValue) =>
  CALL_OUTCOMES.find((outcome) => outcome.value === value)?.label ?? value;
