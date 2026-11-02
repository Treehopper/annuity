import fs from 'node:fs';
import path from 'node:path';

import de from './de.json';
import en from './en.json';

type Tree = { [k: string]: string | Tree };

function keys(tree: Tree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([k, v]) => (typeof v === 'string' ? [prefix + k] : keys(v, `${prefix}${k}.`)));
}

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return walk(p);
    return /\.(ts|tsx)$/.test(e.name) && !/\.test\./.test(e.name) ? [p] : [];
  });
}

describe('i18n key coverage (D4)', () => {
  const enKeys = new Set(keys(en as Tree));
  const deKeys = new Set(keys(de as Tree));

  it('de.json and en.json have the same keys', () => {
    expect([...enKeys].filter((k) => !deKeys.has(k))).toEqual([]);
    expect([...deKeys].filter((k) => !enKeys.has(k))).toEqual([]);
  });

  it('every literal key used in the code exists', () => {
    const root = path.resolve(__dirname, '../..');
    const files = [...walk(path.join(root, 'src')), ...walk(path.join(root, 'app'))];
    const missing: string[] = [];
    for (const f of files) {
      const src = fs.readFileSync(f, 'utf8');
      for (const m of src.matchAll(/\bt\(\s*'([a-zA-Z][\w.]*)'/g)) {
        const key = m[1]!;
        const plural = enKeys.has(`${key}_one`) && enKeys.has(`${key}_other`);
        if (!enKeys.has(key) && !plural) missing.push(`${path.relative(root, f)}: ${key}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('every validation message key of the core exists', () => {
    const coreSrc = path.resolve(__dirname, '../../packages/core/src');
    const used = new Set<string>();
    for (const f of walk(coreSrc)) for (const m of fs.readFileSync(f, 'utf8').matchAll(/'((?:err|warn)\.[\w.]+)'/g)) used.add(m[1]!);
    expect([...used].filter((k) => !enKeys.has(k))).toEqual([]);
  });
});
