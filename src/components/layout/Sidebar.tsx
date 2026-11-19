'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Icon } from '../ui/Icon';
import { useSidebar } from './SidebarContext';
import { useTransactions } from '@/hooks/useTransactions';
import { useCreditCards } from '@/hooks/useCreditCards';
import { useFamily } from '@/hooks/useFamily';
import { FamilyModal } from '../family/FamilyModal';

interface NavItem {
  href: string;
  label: string;
  icon: string;
  badge?: number | string;
  badgeColor?: string;
}

export function Sidebar({ userName = 'Douglas' }: { userName?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isCollapsed, toggleCollapse, isMobileOpen, setMobileOpen } = useSidebar();
  const [isFamilyModalOpen, setIsFamilyModalOpen] = useState(false);

  const { transactions } = useTransactions();
  const { creditCards } = useCreditCards();
  const { family } = useFamily();

  // Contagem de contas que vencem hoje
  const todayString = new Date().toISOString().split('T')[0];
  const directBillsDueToday = transactions.filter(
    t => !t.credit_card_id && t.type === 'despesa' && t.status === 'pendente' && t.date === todayString
  ).length;

  const cardInvoicesDueToday = creditCards.filter(card => {
    return transactions.some(
      t => t.credit_card_id === card.id && t.status === 'pendente' && t.date === todayString
    );
  }).length;

  const totalDueToday = directBillsDueToday + cardInvoicesDueToday;

  const primaryNavItems: NavItem[] = [
    { href: '/dashboard', label: 'Dashboard', icon: 'grid_view' },
    { 
      href: '/lancamentos', 
      label: 'Lançamentos', 
      icon: 'receipt_long',
      badge: totalDueToday > 0 ? totalDueToday : undefined,
      badgeColor: 'bg-rose-500 text-white'
    },
    { href: '/cartoes', label: 'Cartões', icon: 'credit_card' },
    { href: '/investimentos', label: 'Investimentos', icon: 'trending_up' },
    { href: '/metas', label: 'Metas', icon: 'flag' },
  ];

  const managementNavItems: NavItem[] = [
    { href: '/planejamento', label: 'Planejamento', icon: 'event_note' },
    { href: '/beneficios', label: 'VA & VR', icon: 'restaurant' },
    { href: '/compras', label: 'Lista de Compras', icon: 'shopping_cart' },
    { href: '/importar', label: 'Importar Dados', icon: 'upload_file' },
  ];

  const currentMember = family?.members?.find(m => m.is_current_user);
  const activeDisplayName = currentMember?.display_name || userName;
  const familyName = family?.family_name || 'Família Menezes';

  const handleQuickAdd = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(20);
    }
    router.push('/lancamentos?action=new');
    if (isMobileOpen) {
      setMobileOpen(false);
    }
  };

  const renderNavSection = (items: NavItem[], sectionTitle?: string) => (
    <div className="space-y-1">
      {sectionTitle && !isCollapsed && (
        <div className="px-3 pb-1.5 pt-3 text-[10px] font-extrabold uppercase tracking-wider text-gray-600 dark:text-slate-400">
          {sectionTitle}
        </div>
      )}
      {items.map((item) => {
        const isActive = pathname.startsWith(item.href);
        return (
          <div key={item.href} className="relative group">
            <Link
              href={item.href}
              onClick={() => {
                if (isMobileOpen) setMobileOpen(false);
              }}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-xs transition-all relative ${
                isActive
                  ? 'bg-[#2D5346] text-[#F7F6F3] dark:bg-cyan-500/15 dark:text-cyan-300 dark:border dark:border-cyan-500/20 font-semibold shadow-xs'
                  : 'text-[#525C56] dark:text-slate-400 hover:text-[#1B221E] dark:hover:text-white hover:bg-[#E3E2DC]/75 dark:hover:bg-slate-800/60'
              } ${isCollapsed ? 'justify-center px-0' : ''}`}
            >
              <div className="relative shrink-0 flex items-center justify-center">
                <Icon
                  name={item.icon}
                  className={`text-[20px] transition-transform duration-200 group-hover:scale-110 ${
                    isActive ? 'text-[#C6E379] dark:text-cyan-400' : ''
                  }`}
                  filled={isActive}
                />
                {isCollapsed && item.badge !== undefined && (
                  <span className="absolute -top-1 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-white dark:ring-slate-900">
                    {item.badge}
                  </span>
                )}
              </div>

              {!isCollapsed && (
                <div className="flex-1 flex items-center justify-between min-w-0">
                  <span className="truncate">{item.label}</span>
                  {item.badge !== undefined && (
                    <span className="ml-2 px-1.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 text-[10px] font-extrabold border border-rose-200 dark:border-rose-900/50">
                      {item.badge}
                    </span>
                  )}
                </div>
              )}
            </Link>

            {/* Floating Tooltip no modo colapsado */}
            {isCollapsed && (
              <div className="hidden md:block opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-1.5 bg-gray-900 dark:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-xl z-50 whitespace-nowrap transition-all duration-200 border border-gray-700/50">
                <div className="flex items-center gap-2">
                  <span>{item.label}</span>
                  {item.badge !== undefined && (
                    <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[9px] font-bold">
                      {item.badge}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <>
      {/* ========================================================
          DESKTOP SIDEBAR
      ======================================================== */}
      <aside
        className={`hidden md:flex flex-col shrink-0 h-screen sticky top-0 z-30 transition-all duration-300 ease-in-out border-r border-[#D6D5CE]/80 dark:border-white/[0.08] bg-[#F2F1EC]/95 dark:bg-[#0c1017]/95 backdrop-blur-xl select-none ${
          isCollapsed ? 'w-[76px]' : 'w-64'
        }`}
      >
        {/* Header da Sidebar */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-[#D6D5CE]/60 dark:border-white/[0.08] relative">
          <div className={`flex items-center gap-3 overflow-hidden ${isCollapsed ? 'justify-center w-full' : ''}`}>
            {/* Logo / Badge */}
            <div className="w-9 h-9 rounded-xl bg-[#2D5346] dark:bg-gradient-to-tr dark:from-cyan-500 dark:to-sky-400 flex items-center justify-center text-[#C6E379] dark:text-white shadow-sm shadow-[#2D5346]/20 dark:shadow-cyan-500/20 shrink-0">
              <Icon name="account_balance_wallet" className="text-[20px]" />
            </div>

            {!isCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className="font-extrabold text-sm text-gray-900 dark:text-white tracking-tight truncate">
                  Finanças
                </span>
                <span className="text-[11px] text-emerald-600 dark:text-cyan-400 font-semibold truncate">
                  {familyName}
                </span>
              </div>
            )}
          </div>

          {/* Botão de Colapsar / Expandir (estilo Exemplo 2) */}
          <button
            onClick={toggleCollapse}
            title={isCollapsed ? 'Expandir barra lateral' : 'Recolher barra lateral'}
            className="absolute -right-3 top-5 w-6 h-6 rounded-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-md flex items-center justify-center text-gray-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:scale-110 transition-all z-40"
          >
            <Icon
              name={isCollapsed ? 'chevron_right' : 'chevron_left'}
              className="text-[14px]"
            />
          </button>
        </div>

        {/* Navegação */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6 no-scrollbar">
          {renderNavSection(primaryNavItems, 'Visão Geral')}
          {renderNavSection(managementNavItems, 'Gestão & Rotina')}
        </div>

        {/* Rodapé da Sidebar */}
        <div className="p-3 border-t border-gray-100 dark:border-slate-800/60 space-y-2 bg-gray-50/50 dark:bg-slate-900/40">
          {/* Botão de Ação Rápida */}
          <button
            onClick={handleQuickAdd}
            className={`w-full flex items-center justify-center gap-2 rounded-xl bg-[#2D5346] hover:bg-[#234137] dark:bg-gradient-to-r dark:from-emerald-600 dark:to-teal-600 dark:hover:from-emerald-500 dark:hover:to-teal-500 text-[#F7F6F3] dark:text-white font-semibold transition-all shadow-sm shadow-[#2D5346]/20 dark:shadow-emerald-600/25 active:scale-98 ${
              isCollapsed ? 'h-10 px-0' : 'py-2.5 px-3 text-xs'
            }`}
            title="Novo Lançamento Rápido"
          >
            <Icon name="add" className="text-[18px] text-[#C6E379] dark:text-white" />
            {!isCollapsed && <span>Novo Lançamento</span>}
          </button>

          {/* Mini Card de Perfil */}
          <div
            onClick={() => setIsFamilyModalOpen(true)}
            className={`flex items-center gap-2.5 p-2 rounded-xl cursor-pointer hover:bg-[#F7F6F3] dark:hover:bg-slate-800/70 border border-transparent hover:border-[#D6D5CE] dark:hover:border-slate-700/60 transition-all ${
              isCollapsed ? 'justify-center' : ''
            }`}
            title="Gerenciar Família e Membros"
          >
            <div className="w-8 h-8 rounded-full bg-[#2D5346] dark:bg-gradient-to-tr dark:from-emerald-600 dark:to-teal-400 flex items-center justify-center text-[#F7F6F3] dark:text-white font-semibold text-xs shadow-xs shrink-0">
              {activeDisplayName.charAt(0).toUpperCase()}
            </div>
            {!isCollapsed && (
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-xs font-bold text-gray-900 dark:text-white truncate">
                  {activeDisplayName}
                </span>
                <span className="text-[10px] text-gray-500 dark:text-slate-400 truncate">
                  {familyName}
                </span>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ========================================================
          MOBILE DRAWER SIDEBAR
      ======================================================== */}
      {isMobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop escurecido */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-fade-in"
            onClick={() => setMobileOpen(false)}
          />

          {/* Painel da gaveta */}
          <div className="relative w-72 max-w-[80vw] bg-white dark:bg-[#111827] h-full shadow-2xl flex flex-col z-10 animate-slide-right">
            {/* Header da gaveta mobile */}
            <div className="h-16 px-4 flex items-center justify-between border-b border-gray-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#2D5346] dark:bg-gradient-to-tr dark:from-emerald-600 dark:to-teal-400 flex items-center justify-center text-[#C6E379] dark:text-white shadow-sm">
                  <Icon name="account_balance_wallet" className="text-[20px]" />
                </div>
                <div className="flex flex-col">
                  <span className="font-extrabold text-sm text-gray-900 dark:text-white">
                    Finanças
                  </span>
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                    {familyName}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setMobileOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800"
              >
                <Icon name="close" size="sm" />
              </button>
            </div>

            {/* Links da gaveta mobile */}
            <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
              {renderNavSection(primaryNavItems, 'Visão Geral')}
              {renderNavSection(managementNavItems, 'Gestão & Rotina')}
            </div>

            {/* Rodapé da gaveta mobile */}
            <div className="p-4 border-t border-gray-100 dark:border-slate-800 space-y-3">
              <button
                onClick={handleQuickAdd}
                className="w-full py-2.5 px-3 rounded-xl bg-[#2D5346] hover:bg-[#234137] dark:bg-gradient-to-r dark:from-emerald-600 dark:to-teal-600 text-[#F7F6F3] dark:text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-sm shadow-[#2D5346]/20 dark:shadow-emerald-600/25"
              >
                <Icon name="add" className="text-[18px] text-[#C6E379] dark:text-white" />
                <span>Novo Lançamento</span>
              </button>

              <div
                onClick={() => {
                  setMobileOpen(false);
                  setIsFamilyModalOpen(true);
                }}
                className="flex items-center gap-3 p-2 rounded-xl bg-[#ECEBE6] dark:bg-slate-900/50 cursor-pointer"
              >
                <div className="w-9 h-9 rounded-full bg-[#2D5346] dark:bg-gradient-to-tr dark:from-emerald-600 dark:to-teal-400 flex items-center justify-center text-[#F7F6F3] dark:text-white font-semibold text-xs">
                  {activeDisplayName.charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-xs font-bold text-gray-900 dark:text-white truncate">
                    {activeDisplayName}
                  </span>
                  <span className="text-[10px] text-gray-500 dark:text-slate-400 truncate">
                    {familyName} • Gerenciar
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Gestão da Família */}
      <FamilyModal
        isOpen={isFamilyModalOpen}
        onClose={() => setIsFamilyModalOpen(false)}
      />
    </>
  );
}
