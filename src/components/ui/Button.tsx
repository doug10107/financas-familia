'use client';
import { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon } from './Icon';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: string;
  loading?: boolean;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const baseClasses = 'inline-flex items-center justify-center rounded-xl font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
  
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg'
  };

  const variantClasses = {
    primary: 'bg-[#006c49] hover:bg-[#10b981] text-white focus:ring-[#006c49] dark:bg-[#4edea3] dark:hover:bg-[#005236] dark:text-[#0f1419]',
    secondary: 'bg-[#0058be]/10 hover:bg-[#0058be]/20 text-[#0058be] focus:ring-[#0058be] dark:bg-[#adc6ff]/10 dark:hover:bg-[#adc6ff]/20 dark:text-[#adc6ff]',
    ghost: 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 focus:ring-gray-200',
    danger: 'bg-[#ba1a1a] hover:bg-red-700 text-white focus:ring-[#ba1a1a] dark:bg-[#ffb4ab] dark:hover:bg-red-400 dark:text-[#0f1419]'
  };

  return (
    <button
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <Icon name="progress_activity" className="animate-spin mr-2" size={size === 'lg' ? 'md' : 'sm'} />
      ) : icon ? (
        <Icon name={icon} className="mr-2" size={size === 'lg' ? 'md' : 'sm'} />
      ) : null}
      {children}
    </button>
  );
}
