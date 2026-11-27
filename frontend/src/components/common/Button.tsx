import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  icon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      icon,
      children,
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    let variantStyles = '';

    switch (variant) {
      case 'primary':
        variantStyles =
          'bg-brand-primary-light text-white dark:bg-brand-cyan dark:text-canvas-dark hover:opacity-95 font-semibold';
        break;
      case 'secondary':
        variantStyles =
          'bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-text-primary-light dark:text-text-primary-dark hover:bg-header-light dark:hover:bg-header-dark';
        break;
      case 'danger':
        variantStyles =
          'border border-anomaly-danger-text-light dark:border-anomaly-danger-text-dark text-anomaly-danger-text-light dark:text-anomaly-danger-text-dark bg-transparent hover:bg-anomaly-danger-bg-light dark:hover:bg-anomaly-danger-bg-dark';
        break;
    }

    return (
      <button
        ref={ref}
        className={`inline-flex items-center justify-center gap-2 px-4 py-2 text-sm rounded-button transition-colors min-h-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary-light dark:focus-visible:ring-brand-primary-dark disabled:opacity-50 disabled:cursor-not-allowed ${variantStyles} ${className}`}
        disabled={disabled}
        {...props}
      >
        {icon && (
          <span className="w-4 h-4 flex items-center justify-center" aria-hidden="true">
            {icon}
          </span>
        )}
        <span>{children}</span>
      </button>
    );
  }
);

Button.displayName = 'Button';
