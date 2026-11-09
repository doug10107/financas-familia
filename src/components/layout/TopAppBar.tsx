'use client';
import { useState, useEffect } from 'react';
import { Icon } from '../ui/Icon';
import { useTheme } from '../ThemeProvider';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { usePathname } from 'next/navigation';
import { useTransactions } from '@/hooks/useTransactions';
import { useCreditCards } from '@/hooks/useCreditCards';
import { useBiometricAuth } from '@/hooks/useBiometricAuth';
import { useFamily } from '@/hooks/useFamily';
import { FamilyModal } from '../family/FamilyModal';
import { useSidebar } from './SidebarContext';

interface TopAppBarProps {
  userName?: string;
}

export function TopAppBar({ userName = 'Usuário' }: TopAppBarProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isFamilyModalOpen, setIsFamilyModalOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const { toggleMobile } = useSidebar();
  const pathname = usePathname();
  const { transactions } = useTransactions();
  const { creditCards } = useCreditCards();
  const { family } = useFamily();
  const { isEnabled: isBioEnabled, hasBiometricCredential, enableBiometrics, disableBiometrics, registerBiometricCredential, lockApp } = useBiometricAuth();

  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [securityLoading, setSecurityLoading] = useState(false);
  const [securityFeedback, setSecurityFeedback] = useState('');

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const currentDate = new Date();
  const formattedDate = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(currentDate);
  const capitalizedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);

  interface NotificationBill {
    id: string;
    description: string;
    amount: number;
    isInvoice?: boolean;
  }

  // Check for bills due today
  const todayString = currentDate.toISOString().split('T')[0];
  const directBillsDueToday: NotificationBill[] = transactions
    .filter(t => !t.credit_card_id && t.type === 'despesa' && t.status === 'pendente' && t.date === todayString)
    .map(t => ({
      id: t.id,
      description: t.description,
      amount: Number(t.amount),
      isInvoice: false
    }));

  // Credit card invoices due today
  const cardInvoicesDueToday: NotificationBill[] = creditCards.reduce<NotificationBill[]>((acc, card) => {
    const pendingTxsToday = transactions.filter(
      t => t.credit_card_id === card.id && t.status === 'pendente' && t.date === todayString
    );
    const totalDue = pendingTxsToday.reduce((sum, t) => sum + Number(t.amount), 0);
    if (totalDue > 0) {
      acc.push({
        id: `fatura-card-${card.id}`,
        description: `Fatura ${card.name}`,
        amount: totalDue,
        isInvoice: true
      });
    }
    return acc;
  }, []);

  const dueTodayBills: NotificationBill[] = [...directBillsDueToday, ...cardInvoicesDueToday];
  const hasNotifications = dueTodayBills.length > 0;

  const handleSaveSecurity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin.length !== 4) return;

    setSecurityLoading(true);
    setSecurityFeedback('');

    const result = await enableBiometrics(newPin);

    setSecurityLoading(false);

    if (result.biometricRegistered) {
      setSecurityFeedback('✅ PIN salvo e digital registrada com sucesso!');
    } else {
      setSecurityFeedback('✅ PIN salvo! A biometria não foi registrada (pode não estar disponível neste dispositivo).');
    }

    setTimeout(() => {
      setIsSecurityModalOpen(false);
      setNewPin('');
      setSecurityFeedback('');
    }, 2000);
  };

  const currentMember = family?.members?.find(m => m.is_current_user);
  const activeDisplayName = currentMember?.display_name || userName;
  const familyName = family?.family_name || 'Família Menezes';

  // Obter título amigável da página atual
  const getPageTitle = () => {
    if (pathname.startsWith('/dashboard')) return 'Visão Geral & Indicadores';
    if (pathname.startsWith('/lancamentos')) return 'Lançamentos & Fluxo';
    if (pathname.startsWith('/cartoes')) return 'Cartões de Crédito';
    if (pathname.startsWith('/investimentos')) return 'Investimentos & Carteira';
    if (pathname.startsWith('/metas')) return 'Metas & Sonhos';
    if (pathname.startsWith('/planejamento')) return 'Planejamento Financeiro';
    if (pathname.startsWith('/beneficios')) return 'Benefícios (VA & VR)';
    if (pathname.startsWith('/compras')) return 'Lista de Compras';
    if (pathname.startsWith('/importar')) return 'Importar Extratos';
    return 'Painel de Controle';
  };

  return (
    <header 
      className={`sticky top-0 z-20 w-full transition-all duration-300 ${
        isScrolled 
          ? 'bg-white/85 dark:bg-[#0f1419]/85 backdrop-blur-xl shadow-xs border-b border-gray-200/50 dark:border-slate-800/80' 
          : 'bg-transparent'
      }`}
    >
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 gap-4">
          {/* Left: Mobile Hambúrguer + Título / Saudação */}
          <div className="flex items-center gap-3">
            {/* Mobile Hamburger Button */}
            <button
              onClick={toggleMobile}
              className="md:hidden p-2 rounded-xl text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Abrir menu lateral"
            >
              <Icon name="menu" className="text-[22px]" />
            </button>

            {/* Mobile avatar */}
            <button
              onClick={() => setIsFamilyModalOpen(true)}
              className="md:hidden w-8 h-8 rounded-full bg-gradient-to-tr from-[#006c49] to-[#10b981] flex items-center justify-center text-white font-extrabold text-xs shadow-xs"
              title="Ver detalhes da Família"
            >
              {activeDisplayName.charAt(0).toUpperCase()}
            </button>

            {/* Contexto da página e saudação */}
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-sm font-extrabold text-gray-900 dark:text-white">
                  {getPageTitle()}
                </span>
                <span className="hidden sm:inline-block text-[11px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full font-bold border border-emerald-500/20">
                  {familyName}
                </span>
              </div>
              <span className="text-[11px] text-gray-600 dark:text-slate-400 font-medium">
                {capitalizedDate}
              </span>
            </div>
          </div>

          {/* Right: Action Icons */}
          <div className="flex items-center gap-1.5 relative shrink-0">
            {/* Family Button */}
            <button 
              onClick={() => setIsFamilyModalOpen(true)}
              className="p-2 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 transition-colors relative"
              title="Minha Família Compartilhada"
            >
              <Icon name="groups" />
            </button>

            {/* Biometric Security Button */}
            <button 
              onClick={() => setIsSecurityModalOpen(true)}
              className={`p-2 rounded-xl transition-colors ${
                isBioEnabled 
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20' 
                  : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300'
              }`}
              title={isBioEnabled ? 'Configurações de Segurança' : 'Ativar Segurança Biométrica / PIN'}
            >
              <Icon name={isBioEnabled ? 'fingerprint' : 'lock_open'} />
            </button>

            {/* Theme Toggle */}
            <button 
              onClick={toggleTheme}
              className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-300"
              aria-label="Alternar tema"
            >
              <Icon name={theme === 'dark' ? 'light_mode' : 'dark_mode'} />
            </button>

            {/* Notifications Dropdown */}
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-300 relative"
                aria-label="Notificações"
              >
                <Icon name="notifications" />
                {hasNotifications && (
                  <span className="absolute top-2 right-2 w-2 h-2 bg-[#ba1a1a] dark:bg-[#ffb4ab] rounded-full animate-pulse"></span>
                )}
              </button>
              
              {showNotifications && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setShowNotifications(false)}
                  />
                  <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-[#1a2332] rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-700/80 overflow-hidden animate-slide-up origin-top-right z-40">
                    <div className="p-4 border-b border-gray-100 dark:border-slate-700 bg-gray-50/80 dark:bg-slate-800/50 flex items-center justify-between">
                      <h3 className="font-bold text-sm text-gray-900 dark:text-white">Notificações</h3>
                      {hasNotifications && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500 text-white">
                          {dueTodayBills.length} hoje
                        </span>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {hasNotifications ? (
                        <ul className="divide-y divide-gray-100 dark:divide-slate-700">
                          {dueTodayBills.map(bill => (
                            <li key={bill.id} className="p-4 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                              <div className="flex gap-3">
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                                  bill.isInvoice 
                                    ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400' 
                                    : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                                }`}>
                                  <Icon name={bill.isInvoice ? "credit_card" : "warning"} size="sm" />
                                </div>
                                <div>
                                  <p className="text-xs text-gray-800 dark:text-gray-200">
                                    {bill.isInvoice ? (
                                      <>A <strong className="font-semibold">{bill.description}</strong> vence hoje!</>
                                    ) : (
                                      <>Conta <strong className="font-semibold">{bill.description}</strong> vencendo hoje!</>
                                    )}
                                  </p>
                                  <p className="text-xs text-red-500 font-bold mt-0.5">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(bill.amount))}
                                  </p>
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="p-8 text-center text-gray-600 dark:text-slate-400 flex flex-col items-center">
                          <Icon name="notifications_off" className="w-8 h-8 mb-2 opacity-50" />
                          <p className="text-xs font-semibold">Tudo tranquilo!</p>
                          <p className="text-[11px] mt-1">Você não tem contas pendentes para hoje.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Security Setup Modal */}
      <Modal
        isOpen={isSecurityModalOpen}
        onClose={() => { setIsSecurityModalOpen(false); setSecurityFeedback(''); }}
        title={isBioEnabled ? 'Segurança do App' : 'Ativar Proteção Biométrica / PIN'}
      >
        {isBioEnabled ? (
          <div className="space-y-4">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800">
              <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                <Icon name="check_circle" size="sm" /> Segurança Ativada
              </p>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1">
                PIN configurado • {hasBiometricCredential ? 'Digital/FaceID registrada ✅' : 'Digital não registrada ⚠️'}
              </p>
            </div>

            {securityFeedback && (
              <p className="text-xs font-semibold bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 p-2.5 rounded-xl">
                {securityFeedback}
              </p>
            )}

            <button
              type="button"
              onClick={() => { lockApp(); setIsSecurityModalOpen(false); }}
              className="w-full text-sm font-semibold py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-colors flex items-center justify-center gap-2 shadow-lg"
            >
              <Icon name="lock" size="sm" /> Bloquear App Agora
            </button>

            <button
              type="button"
              disabled={securityLoading}
              onClick={async () => {
                setSecurityLoading(true);
                setSecurityFeedback('');
                const ok = await registerBiometricCredential();
                setSecurityLoading(false);
                setSecurityFeedback(ok
                  ? '✅ Digital registrada com sucesso! O app agora abrirá com sua digital.'
                  : '⚠️ Não foi possível registrar. Verifique se a biometria está ativada nas configurações do celular.');
              }}
              className="w-full text-xs font-semibold py-2.5 px-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors flex items-center justify-center gap-2"
            >
              <Icon name="fingerprint" size="sm" /> {securityLoading ? 'Registrando...' : (hasBiometricCredential ? 'Recadastrar Digital / FaceID' : 'Registrar Digital / FaceID')}
            </button>

            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={() => { disableBiometrics(); setIsSecurityModalOpen(false); setSecurityFeedback(''); }}
              className="w-full text-xs"
            >
              Desativar Proteção
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSaveSecurity} className="space-y-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Crie um PIN de 4 dígitos. Ao confirmar, o sensor de digital/FaceID do seu celular será ativado para registro.
            </p>
            <Input
              label="PIN de Segurança (4 dígitos)"
              type="password"
              maxLength={4}
              placeholder="Ex: 1234"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              showPasswordToggle
              required
            />
            {securityFeedback && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/30 p-2.5 rounded-xl">
                {securityFeedback}
              </p>
            )}
            <div className="flex justify-end gap-3 pt-3">
              <Button type="button" variant="ghost" onClick={() => setIsSecurityModalOpen(false)}>Cancelar</Button>
              <Button type="submit" variant="primary" disabled={newPin.length !== 4 || securityLoading} loading={securityLoading}>
                {securityLoading ? 'Registrando...' : 'Ativar Segurança'}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Family Management Modal */}
      <FamilyModal
        isOpen={isFamilyModalOpen}
        onClose={() => setIsFamilyModalOpen(false)}
      />
    </header>
  );
}
