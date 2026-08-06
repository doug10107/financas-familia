'use client';
import { ReactNode, useEffect } from 'react';
import { Icon } from './Icon';
import { GlassCard } from './GlassCard';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
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

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div className="w-full sm:w-[90%] sm:max-w-md animate-slide-up relative z-10 mx-auto">
        <GlassCard elevated className="rounded-t-2xl sm:rounded-2xl rounded-b-none sm:rounded-b-2xl p-0 overflow-hidden border-b-0 sm:border-b-[1px]">
          <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-800">
            <h3 className="text-lg font-semibold">{title}</h3>
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
