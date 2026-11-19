import type { Metadata, Viewport } from 'next';
import { Inter, DM_Sans } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/ThemeProvider';
import { ServiceWorkerRegister } from '@/components/mobile/ServiceWorkerRegister';
import { PwaInstallPrompt } from '@/components/mobile/PwaInstallPrompt';
import { QuickAddFAB } from '@/components/mobile/QuickAddFAB';
import { BiometricLockScreenContainer } from '@/components/mobile/BiometricLockScreenContainer';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-ochre',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Finanças Família Menezes',
  description: 'Aplicativo de gestão financeira familiar inteligente',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'Finanças Menezes',
    statusBarStyle: 'black-translucent',
  },
  applicationName: 'Finanças Menezes',
};

export const viewport: Viewport = {
  themeColor: '#2D5346',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={`${dmSans.variable} ${inter.variable}`} suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
        />
        <link rel="apple-touch-icon" href="/icon-192x192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="min-h-screen antialiased bg-[var(--background)] text-[var(--on-surface)] selection:bg-[#C6E379] selection:text-[#1B221E] dark:selection:bg-cyan-500 dark:selection:text-white" suppressHydrationWarning>
        <ThemeProvider>
          <ServiceWorkerRegister />
          <BiometricLockScreenContainer />
          {children}
          <QuickAddFAB />
          <PwaInstallPrompt />
        </ThemeProvider>
      </body>
    </html>
  );
}
