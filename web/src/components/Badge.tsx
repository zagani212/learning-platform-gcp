import type { ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  tone?: 'neutral' | 'accent' | 'muted';
}

export function Badge({ children, tone = 'neutral' }: BadgeProps) {
  const tones = {
    neutral: 'bg-ink-100 text-ink-700',
    accent: 'bg-accent/15 text-accent-dark',
    muted: 'bg-ink-200/80 text-ink-600',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
