/** Shared size tokens — keep in sync with agent.md §6 and theme.ts. */

export const iconSizes = {
  sm: 18,
  md: 20,
  lg: 24,
} as const;

export type IconSize = keyof typeof iconSizes;

/** Book-loader sizes — sm for cards, md for page content, lg for fullscreen. */
export const loadingSizes = {
  sm: 32,
  md: 48,
  lg: 64,
} as const;

export type LoadingSizeToken = keyof typeof loadingSizes;

export const buttonSizes = {
  sm: {
    minHeight: 36,
    padding: '6px 12px',
    fontSize: 13.5,
    icon: iconSizes.sm,
  },
  md: {
    minHeight: 44,
    padding: '10px 18px',
    fontSize: 14.5,
    icon: iconSizes.md,
  },
} as const;

export type ButtonSize = keyof typeof buttonSizes;
