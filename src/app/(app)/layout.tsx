import { redirect } from 'next/navigation';
import { TopAppBar } from '@/components/layout/TopAppBar';
import { BottomNav } from '@/components/layout/BottomNav';
import { Sidebar } from '@/components/layout/Sidebar';
import { SidebarProvider } from '@/components/layout/SidebarContext';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const userName = 'Douglas';

  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-[var(--background)]">
        {/* Sidebar Lateral Retrátil para Desktop e Drawer para Mobile */}
        <Sidebar userName={userName} />

        {/* Área Principal de Conteúdo */}
        <div className="flex-1 flex flex-col min-w-0 transition-all duration-300">
          <TopAppBar userName={userName} />
          <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-28 md:pb-8">
            {children}
          </main>
        </div>

        {/* Barra de Navegação Inferior para Mobile */}
        <BottomNav />
      </div>
    </SidebarProvider>
  );
}
