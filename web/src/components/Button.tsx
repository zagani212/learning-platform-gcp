import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const variants: Record<Variant, string> = {
  primary:
    'bg-accent text-white hover:bg-accent-dark shadow-soft focus-visible:ring-accent',
  secondary:
    'bg-white text-ink-800 ring-1 ring-ink-200 hover:bg-ink-50 focus-visible:ring-ink-300',
  ghost: 'text-ink-600 hover:bg-ink-100/80 focus-visible:ring-ink-200',
  danger: 'bg-coral text-white hover:opacity-90 focus-visible:ring-coral',
};

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
