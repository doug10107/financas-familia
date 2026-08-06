'use client';
import { ReactNode } from 'react';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  elevated?: boolean;
  onClick?: () => void;
}

export function GlassCard({ children, className = '', elevated = false, onClick }: GlassCardProps) {
  return (
    <div
      className={`${elevated ? 'glass-card-elevated' : 'glass-card'} rounded-2xl p-6 ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {children}
    </div>
  );
}
