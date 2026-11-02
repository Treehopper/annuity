import { PALETTE_IDS } from '@alp/core';

import { contrast, contrastRequirements, palettes } from './palettes';

/** Every palette meets the WCAG AA requirements of §6.15. */
describe.each(PALETTE_IDS)('palette %s', (id) => {
  it.each(['light', 'dark'] as const)('%s variant meets contrast requirements', (mode) => {
    const t = palettes[id][mode];
    const failures: string[] = [];
    for (const [token, bgs, min] of contrastRequirements)
      for (const bg of bgs) {
        const ratio = contrast(t[token], t[bg]);
        if (ratio < min) failures.push(`${token} on ${bg}: ${ratio.toFixed(2)} < ${min}`);
      }
    expect(failures).toEqual([]);
  });
  it('chart1 equals primary', () => {
    expect(palettes[id].light.chart1).toBe(palettes[id].light.primary);
    expect(palettes[id].dark.chart1).toBe(palettes[id].dark.primary);
  });
});
