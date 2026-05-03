import type { HTMLAttributes } from 'react';

export function Card({
  className = '',
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-2xl border border-ink-100 bg-white p-6 shadow-soft ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
