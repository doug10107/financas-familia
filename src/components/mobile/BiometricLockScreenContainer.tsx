'use client';

import React from 'react';
import { useBiometricAuth } from '@/hooks/useBiometricAuth';
import { BiometricLockScreen } from './BiometricLockScreen';

export function BiometricLockScreenContainer() {
  const { isLocked, unlockWithPin, unlockWithBiometrics } = useBiometricAuth();

  return (
    <BiometricLockScreen
      isLocked={isLocked}
      onUnlockPin={unlockWithPin}
      onUnlockBiometrics={unlockWithBiometrics}
    />
  );
}
