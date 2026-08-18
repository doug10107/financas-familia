'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '../ui/Icon';

const tabs = [
  { name: 'Dashboard', href: '/dashboard', icon: 'dashboard' },
  { name: 'VA & VR', href: '/beneficios', icon: 'restaurant' },
  { name: 'Compras', href: '/compras', icon: 'shopping_cart' },
  { name: 'Lançamentos', href: '/lancamentos', icon: 'receipt_long' },
  { name: 'Cartões', href: '/cartoes', icon: 'credit_card' },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-[#1a2332] border-t border-gray-200 dark:border-gray-800 pb-safe rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.05)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.2)]">
      <div className="flex justify-around items-center h-16 px-2">
        {tabs.map((tab) => {
          const isActive = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.name}
              href={tab.href}
              className="flex flex-col items-center justify-center w-full h-full gap-1"
            >
              <div className={`flex items-center justify-center w-12 h-8 rounded-full transition-colors ${isActive ? 'bg-[#2170e4]/10 dark:bg-[#004395]/40 text-[#2170e4] dark:text-[#adc6ff]' : 'text-gray-500 dark:text-gray-400'}`}>
                <Icon name={tab.icon} filled={isActive} />
              </div>
              <span className={`text-[10px] font-medium transition-colors ${isActive ? 'text-[#2170e4] dark:text-[#adc6ff]' : 'text-gray-500 dark:text-gray-400'}`}>
                {tab.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
