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
  const baseClasses = 'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
  
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg'
  };

  const variantClasses = {
    primary: 'bg-[#2D5346] hover:bg-[#234137] text-[#F7F6F3] focus:ring-[#2D5346] dark:bg-[#4edea3] dark:hover:bg-[#005236] dark:text-[#0f1419]',
    secondary: 'bg-[#D8E2D4]/80 hover:bg-[#C6E379]/70 text-[#234137] focus:ring-[#5E7B66] dark:bg-[#adc6ff]/10 dark:hover:bg-[#adc6ff]/20 dark:text-[#adc6ff]',
    ghost: 'hover:bg-[#E3E2DC] dark:hover:bg-gray-800 text-[#1B221E] dark:text-gray-200 focus:ring-[#D6D5CE]',
    danger: 'bg-[#B84A39] hover:bg-[#9E3D2E] text-white focus:ring-[#B84A39] dark:bg-[#ffb4ab] dark:hover:bg-red-400 dark:text-[#0f1419]'
  };

  return (
    <button
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <Icon name="progress_activity" className="animate-spin" size={size === 'lg' ? 'md' : 'sm'} />
      ) : icon ? (
        <Icon name={icon} size={size === 'lg' ? 'md' : 'sm'} />
      ) : null}
      {children}
    </button>
  );
}
