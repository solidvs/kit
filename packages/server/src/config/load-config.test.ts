import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ConfigError, loadConfig, platformConfigSchema } from './load-config.js';

const valid = {
  PUBLIC_URL: 'https://portal.example.com',
  OIDC_ISSUER: 'https://id.example.com/realms/internal',
  OIDC_CLIENT_ID: 'portal',
  OIDC_CLIENT_SECRET: 'super-secret-value',
};

function file(content: string): string {
  const path = join(mkdtempSync(join(tmpdir(), 'config-')), 'config');
  writeFileSync(path, content);
  return path;
}

describe('loadConfig', () => {
  it('reads the platform file and applies defaults', () => {
    const config = loadConfig(platformConfigSchema, { path: file(JSON.stringify(valid)) });
    expect(config.PORT).toBe(3000);
    expect(config.SESSION_IDLE_MINUTES).toBe(30);
    expect(config.OIDC_ALLOW_INSECURE_ISSUER).toBe(false);
  });

  it('uses CONFIG_FILE when no path is given', () => {
    const config = loadConfig(platformConfigSchema, { env: { CONFIG_FILE: file(JSON.stringify({ ...valid, PORT: '8080' })) } });
    expect(config.PORT).toBe(8080);
  });

  it('names missing keys and never prints values', () => {
    const path = file(JSON.stringify({ ...valid, OIDC_CLIENT_ID: undefined, PUBLIC_URL: 'not a url' }));
    try {
      loadConfig(platformConfigSchema, { path });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      const message = (error as ConfigError).message;
      expect(message).toContain('OIDC_CLIENT_ID');
      expect(message).toContain('PUBLIC_URL');
      expect(message).not.toContain('super-secret-value');
      expect(message).not.toContain('not a url');
    }
  });

  it('refuses a file that is not JSON', () => {
    expect(() => loadConfig(platformConfigSchema, { path: file('PORT=3000') })).toThrow(ConfigError);
  });

  it('refuses a missing file', () => {
    expect(() => loadConfig(platformConfigSchema, { path: '/nonexistent/config' })).toThrow(/ENOENT/);
  });
});
