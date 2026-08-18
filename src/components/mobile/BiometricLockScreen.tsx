'use client';

import React, { useState } from 'react';
import { Icon } from '@/components/ui/Icon';

interface BiometricLockScreenProps {
  isLocked: boolean;
  onUnlockPin: (pin: string) => boolean;
  onUnlockBiometrics: () => Promise<boolean>;
}

export function BiometricLockScreen({
  isLocked,
  onUnlockPin,
  onUnlockBiometrics
}: BiometricLockScreenProps) {
  const [pinInput, setPinInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isLocked) return null;

  const handleKeyPress = (num: string) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(15);
    }
    setErrorMsg('');

    if (pinInput.length < 4) {
      const nextPin = pinInput + num;
      setPinInput(nextPin);

      if (nextPin.length === 4) {
        setTimeout(() => {
          const success = onUnlockPin(nextPin);
          if (!success) {
            setErrorMsg('PIN incorreto. Tente novamente.');
            setPinInput('');
            if (typeof navigator !== 'undefined' && navigator.vibrate) {
              navigator.vibrate([50, 50, 50]);
            }
          }
        }, 150);
      }
    }
  };

  const handleBackspace = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(10);
    }
    setPinInput(prev => prev.slice(0, -1));
    setErrorMsg('');
  };

  const handleBiometricClick = async () => {
    const success = await onUnlockBiometrics();
    if (!success) {
      setErrorMsg('Biometria não reconhecida. Use o PIN.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0a0f1d] text-white flex flex-col items-center justify-between py-12 px-6 animate-fade-in">
      {/* Top App Brand */}
      <div className="flex flex-col items-center gap-3 pt-6">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-xl shadow-emerald-950/40">
          <Icon name="lock" size="lg" />
        </div>
        <h2 className="text-xl font-bold tracking-tight">Finanças Menezes</h2>
        <p className="text-xs text-gray-400">Aplicativo Protegido por Biometria</p>
      </div>

      {/* Center PIN Indicators & Biometric Trigger */}
      <div className="w-full max-w-xs flex flex-col items-center space-y-6">
        {/* PIN Dots */}
        <div className="flex gap-4 my-2">
          {[0, 1, 2, 3].map(idx => (
            <div
              key={idx}
              className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
                idx < pinInput.length
                  ? 'bg-emerald-400 border-emerald-400 scale-110 shadow-lg shadow-emerald-500/50'
                  : 'border-gray-600 bg-transparent'
              }`}
            />
          ))}
        </div>

        {errorMsg && (
          <p className="text-xs text-rose-400 font-semibold animate-bounce">{errorMsg}</p>
        )}

        {/* Biometrics Button */}
        <button
          onClick={handleBiometricClick}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 transition-all text-xs font-semibold text-emerald-300 border border-emerald-500/30 shadow-lg backdrop-blur-md"
        >
          <Icon name="fingerprint" className="text-emerald-400" />
          Usar FaceID / Digital
        </button>
      </div>

      {/* Numeric Keypad */}
      <div className="w-full max-w-xs grid grid-cols-3 gap-4 pb-4">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
          <button
            key={num}
            type="button"
            onClick={() => handleKeyPress(num)}
            className="w-16 h-16 rounded-full bg-gray-800/60 hover:bg-gray-700/80 text-xl font-bold text-white flex items-center justify-center mx-auto transition-transform active:scale-95 shadow-md border border-gray-700/40"
          >
            {num}
          </button>
        ))}

        <div />

        <button
          type="button"
          onClick={() => handleKeyPress('0')}
          className="w-16 h-16 rounded-full bg-gray-800/60 hover:bg-gray-700/80 text-xl font-bold text-white flex items-center justify-center mx-auto transition-transform active:scale-95 shadow-md border border-gray-700/40"
        >
          0
        </button>

        <button
          type="button"
          onClick={handleBackspace}
          className="w-16 h-16 rounded-full bg-transparent hover:bg-white/10 text-gray-400 flex items-center justify-center mx-auto transition-transform active:scale-95"
        >
          <Icon name="backspace" size="md" />
        </button>
      </div>
    </div>
  );
}
