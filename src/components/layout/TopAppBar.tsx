'use client';
import { useState, useEffect } from 'react';
import { Icon } from '../ui/Icon';
import { useTheme } from '../ThemeProvider';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTransactions } from '@/hooks/useTransactions';

interface TopAppBarProps {
  userName?: string;
}

export function TopAppBar({ userName = 'Usuário' }: TopAppBarProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  const { transactions } = useTransactions();
  
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

  // Check for bills due today
  const todayString = currentDate.toISOString().split('T')[0];
  const dueTodayBills = transactions.filter(
    t => t.type === 'despesa' && t.status === 'pendente' && t.date === todayString
  );
  const hasNotifications = dueTodayBills.length > 0;

  return (
    <header 
      className={`sticky top-0 z-40 w-full transition-all duration-300 ${
        isScrolled 
          ? 'bg-white/70 dark:bg-[#1a2332]/70 backdrop-blur-lg shadow-sm' 
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#006c49] to-[#10b981] flex items-center justify-center text-white font-bold text-lg shadow-sm">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                {capitalizedDate}
              </span>
              <span className="text-sm font-semibold">
                Olá, {userName.split(' ')[0]}
              </span>
            </div>
          </div>
          
          <nav className="hidden md:flex items-center gap-6">
            <Link 
              href="/dashboard" 
              className={`text-sm font-medium transition-colors hover:text-[#006c49] dark:hover:text-[#4edea3] ${pathname.startsWith('/dashboard') ? 'text-[#006c49] dark:text-[#4edea3]' : 'text-gray-600 dark:text-gray-400'}`}
            >
              Dashboard
            </Link>
            <Link 
              href="/lancamentos" 
              className={`text-sm font-medium transition-colors hover:text-[#006c49] dark:hover:text-[#4edea3] ${pathname.startsWith('/lancamentos') ? 'text-[#006c49] dark:text-[#4edea3]' : 'text-gray-600 dark:text-gray-400'}`}
            >
              Lançamentos
            </Link>
            <Link 
              href="/cartoes" 
              className={`text-sm font-medium transition-colors hover:text-[#006c49] dark:hover:text-[#4edea3] ${pathname.startsWith('/cartoes') ? 'text-[#006c49] dark:text-[#4edea3]' : 'text-gray-600 dark:text-gray-400'}`}
            >
              Cartões
            </Link>
            <Link 
              href="/metas" 
              className={`text-sm font-medium transition-colors hover:text-[#006c49] dark:hover:text-[#4edea3] ${pathname.startsWith('/metas') ? 'text-[#006c49] dark:text-[#4edea3]' : 'text-gray-600 dark:text-gray-400'}`}
            >
              Metas
            </Link>
            <Link 
              href="/investimentos" 
              className={`text-sm font-medium transition-colors hover:text-[#006c49] dark:hover:text-[#4edea3] ${pathname.startsWith('/investimentos') ? 'text-[#006c49] dark:text-[#4edea3]' : 'text-gray-600 dark:text-gray-400'}`}
            >
              Investimentos
            </Link>
            <Link 
              href="/beneficios" 
              className={`text-sm font-medium transition-colors hover:text-[#006c49] dark:hover:text-[#4edea3] ${pathname.startsWith('/beneficios') ? 'text-[#006c49] dark:text-[#4edea3]' : 'text-gray-600 dark:text-gray-400'}`}
            >
              VA & VR
            </Link>
            <Link 
              href="/compras" 
              className={`text-sm font-medium transition-colors hover:text-[#006c49] dark:hover:text-[#4edea3] ${pathname.startsWith('/compras') ? 'text-[#006c49] dark:text-[#4edea3]' : 'text-gray-600 dark:text-gray-400'}`}
            >
              Lista Compras
            </Link>
            <Link 
              href="/importar" 
              className={`text-sm font-medium transition-colors hover:text-[#006c49] dark:hover:text-[#4edea3] ${pathname.startsWith('/importar') ? 'text-[#006c49] dark:text-[#4edea3]' : 'text-gray-600 dark:text-gray-400'}`}
            >
              Importar
            </Link>
          </nav>

          <div className="flex items-center gap-2 relative">
            <button 
              onClick={toggleTheme}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-300"
              aria-label="Alternar tema"
            >
              <Icon name={theme === 'dark' ? 'light_mode' : 'dark_mode'} />
            </button>
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-300 relative"
              >
                <Icon name="notifications" />
                {hasNotifications && (
                  <span className="absolute top-2 right-2 w-2 h-2 bg-[#ba1a1a] dark:bg-[#ffb4ab] rounded-full animate-pulse-soft"></span>
                )}
              </button>
              
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-[#1a2332] rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden animate-slide-up origin-top-right">
                  <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <h3 className="font-semibold text-gray-900 dark:text-white">Notificações</h3>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {hasNotifications ? (
                      <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                        {dueTodayBills.map(bill => (
                          <li key={bill.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                            <div className="flex gap-3">
                              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400 shrink-0">
                                <Icon name="warning" size="sm" />
                              </div>
                              <div>
                                <p className="text-sm text-gray-800 dark:text-gray-200">
                                  Você tem a conta <strong className="font-semibold">{bill.description}</strong> vencendo hoje!
                                </p>
                                <p className="text-xs text-red-500 font-medium mt-1">
                                  Valor: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(bill.amount))}
                                </p>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="p-8 text-center text-gray-500 dark:text-gray-400 flex flex-col items-center">
                        <Icon name="notifications_off" className="w-8 h-8 mb-2 opacity-50" />
                        <p className="text-sm">Nenhuma notificação no momento.</p>
                        <p className="text-xs mt-1">Você não tem contas vencendo hoje!</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
