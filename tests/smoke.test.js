import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('scaffolding', () => {
  it('el runner de tests funciona', () => {
    expect(1 + 1).toBe(2);
  });

  it('index.html está en español y referencia el entrypoint', () => {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    expect(html).toContain('<html lang="es">');
    expect(html).toContain('/src/main.js');
  });
});
