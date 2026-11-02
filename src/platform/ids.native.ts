import type { IdGenerator } from '@alp/core';
import * as Crypto from 'expo-crypto';

export const ids: IdGenerator = {
  uuid: () => Crypto.randomUUID(),
};
