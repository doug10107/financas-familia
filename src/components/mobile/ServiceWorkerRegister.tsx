'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            console.log('PWA ServiceWorker registrado com sucesso:', registration.scope);
          })
          .catch((error) => {
            console.error('Falha ao registrar PWA ServiceWorker:', error);
          });
      });
    }
  }, []);

  return null;
}
