import { redirect } from 'next/navigation';
import { TopAppBar } from '@/components/layout/TopAppBar';
import { BottomNav } from '@/components/layout/BottomNav';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Simplified auth check for UI building phase
  // In a real app we would use Supabase client here
  /*
  const supabase = createServerComponentClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    redirect('/login');
  }
  */

  const userName = 'Douglas';

  return (
    <div className="flex flex-col min-h-screen bg-[var(--background)]">
      <TopAppBar userName={userName} />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 mb-16 md:mb-0">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
