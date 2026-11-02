import type { FileGateway } from '@alp/core';

/** Share sheet / document picker arrive with export and backup (milestone M4). */
export const files: FileGateway = {
  share: async () => {
    throw new Error('File export is not available yet on this platform');
  },
  pick: async () => undefined,
};
