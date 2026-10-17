'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';

export function QuickAddFAB() {
  const router = useRouter();

  const handleClick = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(20);
    }
    router.push('/lancamentos?action=new');
  };

  return (
    <button
      onClick={handleClick}
      aria-label="Novo Lançamento Rápido"
      className="md:hidden fixed right-4 bottom-22 z-40 w-13 h-13 rounded-full bg-gradient-to-r from-[#006c49] to-[#10b981] text-white flex items-center justify-center shadow-xl shadow-emerald-950/40 hover:scale-105 active:scale-95 transition-all duration-200 border-2 border-white/20 cursor-pointer"
    >
      <Icon name="add" size="md" />
    </button>
  );
}
