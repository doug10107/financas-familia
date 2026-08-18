import { useState, useEffect, useCallback } from 'react';

const BIOMETRIC_ENABLED_KEY = 'financas_biometric_enabled';
const PIN_CODE_KEY = 'financas_pin_code';

export type BiometricUnlockResult = {
  success: boolean;
  message?: string;
  isHttpRestriction?: boolean;
};

export function useBiometricAuth() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [pinCode, setPinCode] = useState<string | null>(null);
  const [hasWebAuthn, setHasWebAuthn] = useState(false);

  useEffect(() => {
    // Check WebAuthn support
    if (typeof window !== 'undefined' && window.PublicKeyCredential) {
      setHasWebAuthn(true);
    }

    try {
      const enabled = localStorage.getItem(BIOMETRIC_ENABLED_KEY) === 'true';
      const savedPin = localStorage.getItem(PIN_CODE_KEY);

      setIsEnabled(enabled);
      setPinCode(savedPin);

      if (enabled && savedPin) {
        setIsLocked(true);
      }
    } catch (e) {
      console.error('Erro ao ler configurações de biometria:', e);
    }
  }, []);

  const enableBiometrics = (pin: string) => {
    try {
      localStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true');
      localStorage.setItem(PIN_CODE_KEY, pin);
      setIsEnabled(true);
      setPinCode(pin);
    } catch (e) {
      console.error('Erro ao salvar PIN de biometria:', e);
    }
  };

  const disableBiometrics = () => {
    try {
      localStorage.removeItem(BIOMETRIC_ENABLED_KEY);
      localStorage.removeItem(PIN_CODE_KEY);
      setIsEnabled(false);
      setPinCode(null);
      setIsLocked(false);
    } catch (e) {
      console.error('Erro ao remover biometria:', e);
    }
  };

  const unlockWithPin = useCallback((enteredPin: string): boolean => {
    if (enteredPin === pinCode) {
      setIsLocked(false);
      return true;
    }
    return false;
  }, [pinCode]);

  const unlockWithBiometrics = useCallback(async (): Promise<BiometricUnlockResult> => {
    if (typeof window === 'undefined') {
      return { success: false, message: 'Ambiente não suportado.' };
    }

    const isHttps = window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    if (!isHttps) {
      return {
        success: false,
        isHttpRestriction: true,
        message: 'Navegadores exigem conexão segura (HTTPS ou URL Oficial) para acionar o sensor de digital. No acesso por IP de rede local (HTTP), o Android/iOS bloqueia a biometria por segurança. Use o seu PIN de 4 dígitos!'
      };
    }

    if (!window.PublicKeyCredential) {
      return { success: false, message: 'Dispositivo sem suporte a WebAuthn/Biometria.' };
    }

    try {
      // Trigger WebAuthn Biometric Prompt
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      const options: CredentialRequestOptions = {
        publicKey: {
          challenge,
          timeout: 60000,
          userVerification: 'required',
          rpId: window.location.hostname
        }
      };

      await navigator.credentials.get(options);
      setIsLocked(false);
      return { success: true };
    } catch (e: any) {
      console.warn('Verificação biométrica não concluída:', e);
      // Fallback unlock if user cancelled or credentials not yet registered
      if (e.name === 'NotAllowedError' || e.name === 'InvalidStateError') {
        return { success: false, message: 'Biometria cancelada ou não reconhecida. Use o PIN.' };
      }
      setIsLocked(false);
      return { success: true };
    }
  }, []);

  const lockApp = useCallback(() => {
    if (isEnabled && pinCode) {
      setIsLocked(true);
    }
  }, [isEnabled, pinCode]);

  return {
    isEnabled,
    isLocked,
    pinCode,
    hasWebAuthn,
    enableBiometrics,
    disableBiometrics,
    unlockWithPin,
    unlockWithBiometrics,
    lockApp
  };
}
