'use client';

import React from 'react';
import { useBiometricAuth } from '@/hooks/useBiometricAuth';
import { BiometricLockScreen } from './BiometricLockScreen';

export function BiometricLockScreenContainer() {
  const { isLocked, hasBiometricCredential, unlockWithPin, unlockWithBiometrics } = useBiometricAuth();

  return (
    <BiometricLockScreen
      isLocked={isLocked}
      hasBiometricCredential={hasBiometricCredential}
      onUnlockPin={unlockWithPin}
      onUnlockBiometrics={unlockWithBiometrics}
    />
  );
}
