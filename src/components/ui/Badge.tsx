'use client';
import { ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  color?: 'green' | 'blue' | 'purple' | 'red' | 'gray' | 'yellow';
  className?: string;
}

export function Badge({ children, color = 'gray', className = '' }: BadgeProps) {
  const colorStyles = {
    green: 'bg-[#D8E2D4] text-[#234137] dark:bg-[#005236] dark:text-[#4edea3]',
    blue: 'bg-[#DDE6E2] text-[#2D5346] dark:bg-[#004395] dark:text-[#adc6ff]',
    purple: 'bg-[#E5E3EA] text-[#4A4668] dark:bg-[#494bd6]/30 dark:text-[#c0c1ff]',
    red: 'bg-[#F4E6E2] text-[#B84A39] dark:bg-[#ffb4ab]/20 dark:text-[#ffb4ab]',
    yellow: 'bg-[#C6E379]/65 text-[#234137] dark:bg-yellow-500/30 dark:text-yellow-300',
    gray: 'bg-[#E3E2DC] text-[#525C56] dark:bg-gray-800 dark:text-gray-300'
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${colorStyles[color]} ${className}`}>
      {children}
    </span>
  );
}
