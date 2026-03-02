import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('main modal rendering safety', () => {
  it('does not use button.innerHTML for level/chest choice text', () => {
    const source = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(/button\.innerHTML\s*=/);
  });
});
