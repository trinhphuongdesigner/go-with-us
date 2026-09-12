import type { CSSProperties } from 'react';
import type { CareerMateIconName } from '@/lib/careermateIcons';

export type CareerMateIconProps = {
  name: CareerMateIconName;
  size?: 18 | 20 | 24;
  /** Omit when the icon sits beside visible text. Label the button for icon-only actions. */
  label?: string;
  className?: string;
  style?: CSSProperties;
};

export function CareerMateIcon({ name, size = 20, label, className, style }: CareerMateIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
    >
      <use href={`/brand/careermate/v1/icons/sprite.svg#${name}`} />
    </svg>
  );
}
