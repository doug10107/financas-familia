import { useState, useEffect, useCallback } from 'react';

const BIOMETRIC_ENABLED_KEY = 'financas_biometric_enabled';
const PIN_CODE_KEY = 'financas_pin_code';
const CREDENTIAL_ID_KEY = 'financas_webauthn_credential_id';

export type BiometricUnlockResult = {
  success: boolean;
  message?: string;
};

// Helper: convert ArrayBuffer to base64
function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach(b => binary += String.fromCharCode(b));
  return window.btoa(binary);
}

// Helper: convert base64 to ArrayBuffer
function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export function useBiometricAuth() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [pinCode, setPinCode] = useState<string | null>(null);
  const [hasWebAuthn, setHasWebAuthn] = useState(false);
  const [hasBiometricCredential, setHasBiometricCredential] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check WebAuthn + platform authenticator support
    if (window.PublicKeyCredential) {
      setHasWebAuthn(true);
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable?.()
        .then(available => {
          if (available) {
            setHasWebAuthn(true);
          }
        })
        .catch(() => {});
    }

    try {
      const enabled = localStorage.getItem(BIOMETRIC_ENABLED_KEY) === 'true';
      const savedPin = localStorage.getItem(PIN_CODE_KEY);
      const savedCredId = localStorage.getItem(CREDENTIAL_ID_KEY);

      setIsEnabled(enabled);
      setPinCode(savedPin);
      setHasBiometricCredential(!!savedCredId);

      if (enabled && savedPin) {
        setIsLocked(true);
      }
    } catch (e) {
      console.error('Erro ao ler configurações de biometria:', e);
    }
  }, []);

  // Register a WebAuthn credential (called once when user enables biometrics)
  const registerBiometricCredential = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined' || !window.PublicKeyCredential) {
      return false;
    }

    try {
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      const userId = new Uint8Array(16);
      window.crypto.getRandomValues(userId);

      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: {
            name: 'Finanças Menezes',
            id: window.location.hostname
          },
          user: {
            id: userId,
            name: 'usuario@financas-menezes',
            displayName: 'Usuário Finanças'
          },
          pubKeyCredParams: [
            { type: 'public-key', alg: -7 },   // ES256
            { type: 'public-key', alg: -257 }  // RS256
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',  // Biometria do dispositivo (digital/FaceID)
            userVerification: 'required',
            residentKey: 'preferred'
          },
          timeout: 60000
        }
      }) as PublicKeyCredential;

      if (credential) {
        const credentialId = bufferToBase64(credential.rawId);
        localStorage.setItem(CREDENTIAL_ID_KEY, credentialId);
        setHasBiometricCredential(true);
        console.log('Credencial biométrica registrada com sucesso!');
        return true;
      }
      return false;
    } catch (e: any) {
      console.error('Erro ao registrar credencial biométrica:', e);
      return false;
    }
  }, []);

  const enableBiometrics = useCallback(async (pin: string): Promise<{ pinSaved: boolean; biometricRegistered: boolean }> => {
    try {
      localStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true');
      localStorage.setItem(PIN_CODE_KEY, pin);
      setIsEnabled(true);
      setPinCode(pin);

      // Attempt to register biometric credential
      const biometricRegistered = await registerBiometricCredential();

      return { pinSaved: true, biometricRegistered };
    } catch (e) {
      console.error('Erro ao salvar configurações de segurança:', e);
      return { pinSaved: false, biometricRegistered: false };
    }
  }, [registerBiometricCredential]);

  const disableBiometrics = () => {
    try {
      localStorage.removeItem(BIOMETRIC_ENABLED_KEY);
      localStorage.removeItem(PIN_CODE_KEY);
      localStorage.removeItem(CREDENTIAL_ID_KEY);
      setIsEnabled(false);
      setPinCode(null);
      setIsLocked(false);
      setHasBiometricCredential(false);
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
    if (typeof window === 'undefined' || !window.PublicKeyCredential) {
      return { success: false, message: 'Dispositivo sem suporte a biometria.' };
    }

    const savedCredId = localStorage.getItem(CREDENTIAL_ID_KEY);
    if (!savedCredId) {
      return { success: false, message: 'Nenhuma credencial biométrica cadastrada. Use o PIN e reconfigure a biometria nas configurações.' };
    }

    try {
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      const credentialId = base64ToBuffer(savedCredId);

      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge,
          rpId: window.location.hostname,
          allowCredentials: [{
            type: 'public-key',
            id: credentialId
          }],
          userVerification: 'required',
          timeout: 60000
        }
      });

      if (assertion) {
        setIsLocked(false);
        return { success: true };
      }

      return { success: false, message: 'Biometria não reconhecida. Use o PIN.' };
    } catch (e: any) {
      console.warn('Verificação biométrica não concluída:', e);

      if (e.name === 'NotAllowedError') {
        return { success: false, message: 'Autenticação cancelada. Use o PIN.' };
      }
      if (e.name === 'SecurityError') {
        return { success: false, message: 'Erro de segurança. Verifique se está acessando pela URL HTTPS oficial.' };
      }

      return { success: false, message: 'Erro na biometria. Use o PIN.' };
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
    hasBiometricCredential,
    enableBiometrics,
    disableBiometrics,
    registerBiometricCredential,
    unlockWithPin,
    unlockWithBiometrics,
    lockApp
  };
}
