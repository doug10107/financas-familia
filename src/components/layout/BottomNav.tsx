'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '../ui/Icon';
import { useTheme } from '../ThemeProvider';

interface TabItem {
  name: string;
  href: string;
  icon: string;
}

const primaryTabs: TabItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: 'grid_view' },
  { name: 'Lançamentos', href: '/lancamentos', icon: 'swap_horiz' },
  { name: 'Metas', href: '/metas', icon: 'track_changes' },
  { name: 'Investimentos', href: '/investimentos', icon: 'trending_up' },
];

const secondaryModules = [
  {
    name: 'Cartões de Crédito',
    href: '/cartoes',
    desc: 'Faturas, limites e fechamento',
    icon: 'credit_card',
    color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  },
  {
    name: 'VA & VR',
    href: '/beneficios',
    desc: 'Saldo de alimentação e refeição',
    icon: 'restaurant',
    color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  },
  {
    name: 'Lista de Compras',
    href: '/compras',
    desc: 'Supermercado e controle de itens',
    icon: 'shopping_cart',
    color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  },
  {
    name: 'Planejamento',
    href: '/planejamento',
    desc: 'Viagens, reformas e orçamentos',
    icon: 'event_note',
    color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  },
  {
    name: 'Importar Extratos',
    href: '/importar',
    desc: 'Upload de OFX e faturas bancárias',
    icon: 'upload_file',
    color: 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
  },
];

export function BottomNav() {
  const pathname = usePathname();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  // Check if current active route belongs to the "Mais" secondary modules
  const isSecondaryActive = secondaryModules.some((m) => pathname.startsWith(m.href));

  return (
    <>
      {/* FLOATING MOBILE DOCK (STITCH DESIGN SYSTEM) */}
      <div className="md:hidden fixed bottom-0 w-full z-40 pointer-events-none pb-safe">
        <nav className="pointer-events-auto max-w-md mx-3 sm:mx-auto mb-3 h-15 bg-white/90 dark:bg-[#111827]/90 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.4)] rounded-full px-2 flex items-center justify-between border border-gray-200/80 dark:border-slate-800">
          {primaryTabs.map((tab) => {
            const isActive = pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.name}
                href={tab.href}
                onClick={() => setIsDrawerOpen(false)}
                className={`flex-1 min-w-[50px] h-full flex flex-col items-center justify-center gap-0.5 transition-all ${
                  isActive
                    ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                    : 'text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-white'
                }`}
              >
                <div
                  className={`w-9 h-7 rounded-full flex items-center justify-center transition-all ${
                    isActive
                      ? 'bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                      : ''
                  }`}
                >
                  <Icon name={tab.icon} className="text-[20px]" filled={isActive} />
                </div>
                <span className="text-[10px] tracking-tight">{tab.name}</span>
              </Link>
            );
          })}

          {/* Botão "Mais" que abre o Drawer de Módulos */}
          <button
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            aria-label="Abrir menu de módulos"
            className={`flex-1 min-w-[50px] h-full flex flex-col items-center justify-center gap-0.5 transition-all ${
              isSecondaryActive || isDrawerOpen
                ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                : 'text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-white'
            }`}
          >
            <div
              className={`w-9 h-7 rounded-full flex items-center justify-center transition-all ${
                isSecondaryActive || isDrawerOpen
                  ? 'bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                  : ''
              }`}
            >
              <Icon name="apps" className="text-[20px]" />
            </div>
            <span className="text-[10px] tracking-tight">Mais</span>
          </button>
        </nav>
      </div>

      {/* MOBILE DRAWER / BOTTOM SHEET FOR SECONDARY MODULES */}
      {isDrawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-fade-in"
            onClick={() => setIsDrawerOpen(false)}
          />

          {/* Drawer Body */}
          <div className="relative w-full bg-white dark:bg-[#111827] rounded-t-3xl shadow-2xl border-t border-gray-200 dark:border-slate-800 p-5 pb-safe z-10 animate-slide-up max-h-[85vh] overflow-y-auto custom-scrollbar">
            {/* Grabber handle */}
            <div className="w-12 h-1.5 bg-gray-300 dark:bg-slate-700 rounded-full mx-auto mb-4" />

            <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100 dark:border-slate-800">
              <div>
                <h3 className="font-extrabold text-base text-gray-900 dark:text-white">
                  Módulos & Gestão
                </h3>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  Todas as ferramentas do seu app financeiro
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-500 hover:text-gray-900 dark:hover:text-white flex items-center justify-center transition-colors"
              >
                <Icon name="close" className="text-[18px]" />
              </button>
            </div>

            {/* List of Secondary Modules */}
            <div className="space-y-2">
              {secondaryModules.map((item) => {
                const isSubActive = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsDrawerOpen(false)}
                    className={`flex items-center gap-3.5 p-3 rounded-2xl transition-all ${
                      isSubActive
                        ? 'bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                        : 'hover:bg-gray-50 dark:hover:bg-slate-800/60 border border-gray-100 dark:border-slate-800/80 text-gray-800 dark:text-slate-200'
                    }`}
                  >
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${item.color} shadow-xs`}
                    >
                      <Icon name={item.icon} className="text-[22px]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold truncate">{item.name}</p>
                      <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{item.desc}</p>
                    </div>
                    <Icon name="chevron_right" className="text-gray-400 text-[18px]" />
                  </Link>
                );
              })}
            </div>

            {/* Quick Actions Footer */}
            <div className="mt-5 pt-4 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setTheme(theme === 'dark' ? 'light' : 'dark');
                }}
                className="flex-1 py-2.5 px-3 rounded-xl bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-2 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
              >
                <Icon name={theme === 'dark' ? 'light_mode' : 'dark_mode'} size="sm" />
                <span>Tema {theme === 'dark' ? 'Claro' : 'Escuro'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
