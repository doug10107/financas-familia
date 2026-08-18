'use client';

import React, { useState, useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Check if already running in standalone PWA mode
    const isStandaloneApp = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    setIsStandalone(isStandaloneApp);

    if (isStandaloneApp) return;

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    if (isIosDevice && !isStandaloneApp) {
      setShowPrompt(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  if (isStandalone || !showPrompt) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-6 md:bottom-6 z-40 max-w-sm animate-slide-up">
      <div className="bg-[#0f172a]/95 text-white backdrop-blur-xl p-4 rounded-2xl border border-emerald-500/30 shadow-2xl shadow-black/50 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-700 flex items-center justify-center text-white shrink-0 shadow-lg">
              <Icon name="smartphone" size="md" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-white">Instalar App no Celular</h4>
              <p className="text-[11px] text-gray-300">Acesse como um app nativo direto da tela de início!</p>
            </div>
          </div>

          <button
            onClick={() => setShowPrompt(false)}
            className="text-gray-400 hover:text-white p-1"
          >
            <Icon name="close" size="sm" />
          </button>
        </div>

        {isIOS ? (
          <div className="bg-white/10 p-2.5 rounded-xl text-[11px] text-gray-200 space-y-1">
            <p className="font-semibold text-emerald-300 flex items-center gap-1">
              <Icon name="share" size="sm" /> No iPhone / Safari:
            </p>
            <p>Toque em <strong>Compartilhar</strong> e selecione <strong>"Adicionar à Tela de Início"</strong>.</p>
          </div>
        ) : (
          <Button
            variant="primary"
            size="sm"
            onClick={handleInstallClick}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-2.5 rounded-xl"
          >
            Instalar Aplicativo Agora
          </Button>
        )}
      </div>
    </div>
  );
}
