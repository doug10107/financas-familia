'use client';
import { ReactNode } from 'react';
import { Icon } from './Icon';
import { Button } from './Button';

interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionIcon?: string;
}

export function EmptyState({ icon, title, description, actionLabel, onAction, actionIcon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center animate-fade-in">
      <div className="w-16 h-16 mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 dark:text-gray-500">
        <Icon name={icon} size="lg" />
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-sm text-sm">
        {description}
      </p>
      {actionLabel && onAction && (
        <Button onClick={onAction} icon={actionIcon} variant="secondary">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
