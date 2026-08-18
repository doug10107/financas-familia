'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      // Register immediately — don't wait for 'load' event since useEffect runs after hydration
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('PWA ServiceWorker registrado com sucesso. Scope:', registration.scope);

          // Check for updates periodically
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'activated') {
                  console.log('Novo ServiceWorker ativado.');
                }
              });
            }
          });
        })
        .catch((error) => {
          console.error('Falha ao registrar PWA ServiceWorker:', error);
        });
    }
  }, []);

  return null;
}
