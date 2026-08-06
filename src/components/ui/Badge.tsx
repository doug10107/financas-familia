'use client';
import { ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  color?: 'green' | 'blue' | 'purple' | 'red' | 'gray' | 'yellow';
  className?: string;
}

export function Badge({ children, color = 'gray', className = '' }: BadgeProps) {
  const colorStyles = {
    green: 'bg-[#10b981]/20 text-[#006c49] dark:bg-[#005236] dark:text-[#4edea3]',
    blue: 'bg-[#2170e4]/20 text-[#0058be] dark:bg-[#004395] dark:text-[#adc6ff]',
    purple: 'bg-[#494bd6]/20 text-[#494bd6] dark:bg-[#494bd6]/30 dark:text-[#c0c1ff]',
    red: 'bg-[#ba1a1a]/10 text-[#ba1a1a] dark:bg-[#ffb4ab]/20 dark:text-[#ffb4ab]',
    yellow: 'bg-yellow-500/20 text-yellow-700 dark:bg-yellow-500/30 dark:text-yellow-300',
    gray: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${colorStyles[color]} ${className}`}>
      {children}
    </span>
  );
}
