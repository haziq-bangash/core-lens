/** Digests go out at 08:00 in the user's own timezone. Safe to import from client components. */
export const LOOKOUT_FREQUENCIES = {
  daily: { label: 'Daily', description: 'Every morning', cron: '0 8 * * *' },
  weekly: { label: 'Weekly', description: 'Monday mornings', cron: '0 8 * * 1' },
  monthly: { label: 'Monthly', description: 'The 1st of each month', cron: '0 8 1 * *' },
} as const;

export type LookoutFrequency = keyof typeof LOOKOUT_FREQUENCIES;

export const LOOKOUT_FREQUENCY_KEYS = Object.keys(LOOKOUT_FREQUENCIES) as [LookoutFrequency, ...LookoutFrequency[]];

export const isLookoutFrequency = (value: string): value is LookoutFrequency => value in LOOKOUT_FREQUENCIES;
