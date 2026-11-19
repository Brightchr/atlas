import type { ButtonHTMLAttributes, ReactNode } from 'react';

/** The app's one button. Every tappable action goes through these classes so
 * sizes and looks stay consistent; nothing is smaller than 44px tall, because
 * the app is used one-handed in a gym.
 *
 * `buttonClasses()` exists for things that must be a <Link> but look like a
 * button — same variants, same sizes. */

export type ButtonVariant = 'primary' | 'secondary' | 'soft' | 'ghost' | 'danger';
export type ButtonSize = 'md' | 'lg' | 'xl';

const base =
  'springy inline-flex select-none items-center justify-center gap-2 rounded-xl font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-linear-to-r from-accent to-accent-2 text-accent-ink shadow-sm hover:opacity-90',
  secondary: 'border border-line bg-surface text-ink shadow-sm hover:bg-elev',
  soft: 'bg-accent-soft text-accent hover:bg-accent hover:text-accent-ink',
  ghost: 'text-muted hover:bg-elev hover:text-ink',
  danger: 'bg-rose-500/10 text-rose-500 hover:bg-rose-500/20',
};

// Phones keep 44px+ targets for thumbs. From md up (a mouse or trackpad) the
// same buttons tighten, otherwise a desktop page is all oversized bars.
const sizes: Record<ButtonSize, string> = {
  md: 'min-h-11 px-4 text-sm md:min-h-9 md:px-3.5',
  lg: 'min-h-11 px-5 text-sm md:min-h-10',
  xl: 'min-h-12 px-6 text-base md:min-h-11',
};

export function buttonClasses(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  extra = '',
): string {
  return `${base} ${variants[variant]} ${sizes[size]} ${extra}`.trim();
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  className = '',
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses(variant, size, `${block ? 'w-full' : ''} ${className}`)}
      {...rest}
    >
      {children}
    </button>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required: icon-only buttons need a name for screen readers. */
  label: string;
  variant?: 'ghost' | 'secondary' | 'soft' | 'danger';
  children: ReactNode;
}

/** A square, 44px icon-only button. */
export function IconButton({
  label,
  variant = 'ghost',
  className = '',
  type = 'button',
  children,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      className={`${base} ${variants[variant]} h-11 w-11 shrink-0 md:h-9 md:w-9 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
