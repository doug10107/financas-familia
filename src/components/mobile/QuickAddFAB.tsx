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
      className="md:hidden fixed right-5 bottom-20 z-40 w-14 h-14 rounded-full bg-gradient-to-r from-[#006c49] to-[#10b981] text-white flex items-center justify-center shadow-2xl shadow-emerald-950/50 hover:scale-105 active:scale-95 transition-all duration-200 border-2 border-white/20"
    >
      <Icon name="add" size="lg" />
    </button>
  );
}
