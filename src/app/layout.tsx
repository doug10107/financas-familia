import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/ThemeProvider';
import { ServiceWorkerRegister } from '@/components/mobile/ServiceWorkerRegister';
import { PwaInstallPrompt } from '@/components/mobile/PwaInstallPrompt';
import { QuickAddFAB } from '@/components/mobile/QuickAddFAB';
import { BiometricLockScreenContainer } from '@/components/mobile/BiometricLockScreenContainer';

const inter = Inter({ subsets: ['latin'] });

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
  themeColor: '#006c49',
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
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
        />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className={`${inter.className} min-h-screen antialiased bg-[var(--background)] text-[var(--on-surface)] selection:bg-emerald-500 selection:text-white`} suppressHydrationWarning>
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
