import type { FileGateway } from '@alp/core';

/** Web file transfer: Blob download and <input type=file> (§4.7). */
export const files: FileGateway = {
  async share({ name, mimeType, content, bom }) {
    const blob = new Blob([bom ? '﻿' : '', content], { type: `${mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
  pick() {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.csv,text/csv,text/plain';
      input.onchange = async () => {
        const f = input.files?.[0];
        resolve(f ? { name: f.name, content: await f.text() } : undefined);
      };
      input.click();
    });
  },
};
