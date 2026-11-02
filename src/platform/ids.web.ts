import type { IdGenerator } from '@alp/core';

export const ids: IdGenerator = {
  uuid: () => crypto.randomUUID(),
};
