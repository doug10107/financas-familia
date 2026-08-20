'use client';
import { ReactNode, useEffect } from 'react';
import { Icon } from './Icon';
import { GlassCard } from './GlassCard';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
}

export function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'sm:max-w-sm',
    md: 'sm:max-w-md',
    lg: 'sm:max-w-lg',
    xl: 'sm:max-w-2xl',
    '2xl': 'sm:max-w-4xl',
    full: 'sm:max-w-5xl'
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in p-0 sm:p-4">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div className={`w-full sm:w-[95%] ${sizeClasses[size] || sizeClasses.md} animate-slide-up relative z-10 mx-auto`}>
        <GlassCard elevated className="rounded-t-2xl sm:rounded-2xl rounded-b-none sm:rounded-b-2xl p-0 overflow-hidden border-b-0 sm:border-b-[1px]">
          <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-200 dark:border-gray-800">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
            <button
              onClick={onClose}
              className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500"
            >
              <Icon name="close" />
            </button>
          </div>
          <div className="p-5 overflow-y-auto max-h-[80vh]">
            {children}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
