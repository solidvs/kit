/**
 * End-to-end check of ADR-0018 against a real Keycloak with the platform's extensions
 * (packages/keycloak-extensions) and the `external` realm of lab/identity: the second factor on a
 * new device, remembered devices with rotation and reuse detection, the stronger level for
 * sensitive actions, and the realm policy that administrators switch.
 *
 * Run with `pnpm --filter @solidvs/server test:lab` after building the login theme and the
 * extensions. Plays the browser with fetch and a cookie jar; computes the authenticator app's
 * codes from the seed generated for this run. Uses its own compose project and port, so it can run
 * while a development laboratory is up.
 */
import { execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { renderIdentityTemplate, stageKeycloak, totp } from '../../../lab/keycloak.ts';

const LAB = join(dirname(fileURLToPath(import.meta.url)), '../../../lab/identity');
const PORT = 8091;
const BASE = `http://localhost:${PORT}`;
const ISSUER = `${BASE}/realms/external`;
const REDIRECT_URI = 'http://localhost:3998/api/auth/callback';
const DEVICE_COOKIE = 'SOLIDVS_DEVICE';
const CREDENTIAL_TYPE = 'solidvs-remembered-device';
const WINDOWS_CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36';

const secret = () => randomBytes(18).toString('base64url');
const values = {
  ANA_PASSWORD: secret(),
  BRUNO_PASSWORD: secret(),
  CLIENT_SECRET: secret(),
  EXAMPLE_CLIENT_SECRET: secret(),
  LDAP_ADMIN_PASSWORD: secret(),
  CARLA_PASSWORD: secret(),
  CARLA_OTP_SECRET: secret().slice(0, 20),
  PARTNER_CLIENT_SECRET: secret(),
};
const keycloakAdminPassword = secret();
let carlaPassword = values.CARLA_PASSWORD;

mkdirSync(join(homedir(), '.cache', 'platform-kit-lab'), { recursive: true });
const workdir = mkdtempSync(join(homedir(), '.cache', 'platform-kit-lab', 'devices-'));
const env = {
  ...process.env,
  LAB_WORKDIR: workdir,
  LAB_LDAP_ADMIN_PASSWORD: values.LDAP_ADMIN_PASSWORD,
  LAB_KEYCLOAK_ADMIN_PASSWORD: keycloakAdminPassword,
  LAB_KEYCLOAK_PORT: String(PORT),
  LAB_KEYCLOAK_HEAP: '-Xms128m -Xmx640m',
};

function compose(...args: string[]): string {
  return execFileSync('docker', ['compose', '-p', 'identity-lab-devices', '-f', join(LAB, 'compose.yaml'), ...args], {
    env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

/** A browser: one cookie jar for Keycloak's address, a fixed user agent, no automatic redirects. */
class Browser {
  readonly cookies = new Map<string, string>();

  constructor(readonly userAgent = WINDOWS_CHROME) {}

  /** A new browser that has only this one's remembered-device cookie (its session has ended). */
  withDeviceOnly(): Browser {
    const next = new Browser(this.userAgent);
    const device = this.cookies.get(DEVICE_COOKIE);
    if (device) next.cookies.set(DEVICE_COOKIE, device);
    return next;
  }

  async request(url: string, form?: Record<string, string>): Promise<Response> {
    const headers: Record<string, string> = { 'user-agent': this.userAgent };
    if (this.cookies.size > 0) headers.cookie = [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; ');
    if (form) headers['content-type'] = 'application/x-www-form-urlencoded';
    const response = await fetch(url, { method: form ? 'POST' : 'GET', headers, body: form ? new URLSearchParams(form) : undefined, redirect: 'manual' });
    for (const cookie of response.headers.getSetCookie()) {
      const [pair = '', ...attributes] = cookie.split(';');
      const name = pair.slice(0, pair.indexOf('=')).trim();
      const value = pair.slice(pair.indexOf('=') + 1).trim();
      const cleared = value === '' || attributes.some((attribute) => /^\s*max-age=0\s*$/i.test(attribute));
      if (cleared) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
    return response;
  }
}

type SignIn = { askedForCode: boolean; acr?: string; unexpectedPage?: string };

function formAction(html: string, id: string): string {
  const action = new RegExp(`<form[^>]*id="${id}"[^>]*>`).exec(html)?.[0].match(/action="([^"]+)"/)?.[1];
  if (!action) throw new Error(`form ${id} not found`);
  return action.replaceAll('&amp;', '&');
}

/** Signs carla in to the partner portal through Keycloak; answers the code page when it comes. */
async function signIn(browser: Browser, options: { acr?: string; trust?: boolean } = {}): Promise<SignIn> {
  const verifier = randomBytes(32).toString('base64url');
  const url = new URL(`${ISSUER}/protocol/openid-connect/auth`);
  url.search = new URLSearchParams({
    client_id: 'partner-portal',
    response_type: 'code',
    scope: 'openid',
    redirect_uri: REDIRECT_URI,
    state: secret(),
    code_challenge: createHash('sha256').update(verifier).digest('base64url'),
    code_challenge_method: 'S256',
    ...(options.acr ? { acr_values: options.acr } : {}),
  }).toString();

  let response = await browser.request(url.toString());
  let askedForCode = false;
  for (let step = 0; step < 6; step++) {
    if (response.status === 302 || response.status === 303) {
      const location = new URL(response.headers.get('location')!, BASE).toString();
      if (location.startsWith(REDIRECT_URI)) {
        return { askedForCode, acr: await acrOf(new URL(location).searchParams.get('code')!, verifier) };
      }
      response = await browser.request(location);
      continue;
    }
    const html = await response.text();
    if (html.includes('id="kc-form-login"')) {
      response = await browser.request(formAction(html, 'kc-form-login'), { username: 'carla', password: carlaPassword, credentialId: '' });
    } else if (html.includes('id="kc-otp-login-form"')) {
      askedForCode = true;
      const form: Record<string, string> = {
        otp: await totp(values.CARLA_OTP_SECRET),
        selectedCredentialId: /name="selectedCredentialId" value="([^"]*)"/.exec(html)?.[1] ?? '',
        login: '',
      };
      if (options.trust !== false) form.trustDevice = 'on';
      response = await browser.request(formAction(html, 'kc-otp-login-form'), form);
    } else {
      return { askedForCode, unexpectedPage: html };
    }
  }
  throw new Error('sign-in did not finish');
}

async function acrOf(code: string, verifier: string): Promise<string> {
  const response = await fetch(`${ISSUER}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
      client_id: 'partner-portal',
      client_secret: values.PARTNER_CLIENT_SECRET,
    }),
  });
  expect(response.status).toBe(200);
  const { id_token } = (await response.json()) as { id_token: string };
  return (JSON.parse(Buffer.from(id_token.split('.')[1]!, 'base64url').toString('utf8')) as { acr: string }).acr;
}

/** Administration API of the `external` realm, as the laboratory's Keycloak administrator. */
async function admin(path: string, init: { method?: string; body?: unknown } = {}): Promise<Response> {
  const token = await fetch(`${BASE}/realms/master/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'password', client_id: 'admin-cli', username: 'admin', password: keycloakAdminPassword }),
  });
  const { access_token } = (await token.json()) as { access_token: string };
  return fetch(`${BASE}/admin/realms/external${path}`, {
    method: init.method ?? 'GET',
    headers: { authorization: `Bearer ${access_token}`, 'content-type': 'application/json' },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

let carlaId = '';

async function devices(): Promise<Array<{ id: string; type: string; userLabel?: string }>> {
  const response = await admin(`/users/${carlaId}/credentials`);
  const credentials = (await response.json()) as Array<{ id: string; type: string; userLabel?: string }>;
  return credentials.filter((credential) => credential.type === CREDENTIAL_TYPE);
}

async function forgetAllDevices(): Promise<void> {
  for (const device of await devices()) await admin(`/users/${carlaId}/credentials/${device.id}`, { method: 'DELETE' });
}

/** What an administrator switches in the portal: realm attributes of the second-factor policy. */
async function setPolicy(attributes: Record<string, string>): Promise<void> {
  const realm = (await (await admin('')).json()) as { attributes?: Record<string, string> };
  const response = await admin('', { method: 'PUT', body: { ...realm, attributes: { ...realm.attributes, ...attributes } } });
  expect(response.status).toBe(204);
}

const DEFAULT_POLICY = {
  'solidvs.secondFactor.mode': 'new-device',
  'solidvs.rememberedDevice.maxAgeDays': '90',
  'solidvs.rememberedDevice.idleDays': '30',
  'solidvs.rememberedDevice.maxDevices': '5',
};

async function waitFor(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

describe('ADR-0018 end to end: second factor on new devices, remembered devices, stronger level', () => {
  beforeAll(async () => {
    mkdirSync(join(workdir, 'ldif'));
    mkdirSync(join(workdir, 'realm'));
    writeFileSync(join(workdir, 'ldif', '50-directory.ldif'), renderIdentityTemplate('directory.ldif.template', values));
    writeFileSync(join(workdir, 'realm', 'internal-realm.json'), renderIdentityTemplate('realm.json.template', values));
    writeFileSync(join(workdir, 'realm', 'external-realm.json'), renderIdentityTemplate('external-realm.json.template', values));
    stageKeycloak(workdir);
    compose('up', '-d', 'directory', 'keycloak');
    await waitFor(`${ISSUER}/.well-known/openid-configuration`, 280_000);
    const users = (await (await admin('/users?username=carla&exact=true')).json()) as Array<{ id: string }>;
    carlaId = users[0]!.id;
  }, 300_000);

  afterAll(() => {
    try {
      compose('down', '-v');
    } finally {
      rmSync(workdir, { recursive: true, force: true });
    }
  }, 120_000);

  it('asks for the code on a new device and remembers the device when the box stays ticked', async () => {
    const browser = new Browser();
    expect(await signIn(browser)).toEqual({ askedForCode: true, acr: 'standard' });
    expect(browser.cookies.get(DEVICE_COOKIE)).toMatch(/^[\w-]+\.[\w-]{43}$/);
    const remembered = await devices();
    expect(remembered).toHaveLength(1);
    expect(remembered[0]!.userLabel).toMatch(/^Chrome · Windows \(/);
    await forgetAllDevices();
  });

  it('asks only for the password on a remembered device, and replaces its secret at each use', async () => {
    const first = new Browser();
    await signIn(first);
    const before = first.cookies.get(DEVICE_COOKIE);

    const later = first.withDeviceOnly();
    expect(await signIn(later)).toEqual({ askedForCode: false, acr: 'standard' });
    expect(later.cookies.get(DEVICE_COOKIE)).toBeDefined();
    expect(later.cookies.get(DEVICE_COOKIE)).not.toBe(before);
    expect(await devices()).toHaveLength(1);
    await forgetAllDevices();
  });

  it('remembers nothing when the person unticks the box', async () => {
    const browser = new Browser();
    expect(await signIn(browser, { trust: false })).toEqual({ askedForCode: true, acr: 'standard' });
    expect(browser.cookies.has(DEVICE_COOKIE)).toBe(false);
    expect(await devices()).toHaveLength(0);
    expect((await signIn(browser.withDeviceOnly(), { trust: false })).askedForCode).toBe(true);
  });

  it('detects a copied cookie: the previous secret, used again, forgets every remembered device', async () => {
    const victim = new Browser();
    await signIn(victim);
    const copied = victim.cookies.get(DEVICE_COOKIE)!;
    const victimLater = victim.withDeviceOnly();
    expect((await signIn(victimLater)).askedForCode).toBe(false);

    const attacker = new Browser();
    attacker.cookies.set(DEVICE_COOKIE, copied);
    expect((await signIn(attacker, { trust: false })).askedForCode).toBe(true);
    expect(attacker.cookies.has(DEVICE_COOKIE)).toBe(false);
    expect(await devices()).toHaveLength(0);
    // The victim's current cookie was forgotten with the others: the code is asked again.
    expect((await signIn(victimLater.withDeviceOnly(), { trust: false })).askedForCode).toBe(true);
  });

  it('asks for the code again for a sensitive action (level 2), even on a remembered device', async () => {
    const browser = new Browser();
    await signIn(browser);
    // Same browser, session still open: the system asks for level 2 before a sensitive action.
    expect(await signIn(browser, { acr: 'strong' })).toEqual({ askedForCode: true, acr: 'strong' });
    // Remembered device, no session: the password, then the code for level 2.
    expect(await signIn(browser.withDeviceOnly(), { acr: 'strong' })).toEqual({ askedForCode: true, acr: 'strong' });
    await forgetAllDevices();
  });

  it('lets an administrator forget a device', async () => {
    const browser = new Browser();
    await signIn(browser);
    await forgetAllDevices();
    expect((await signIn(browser.withDeviceOnly(), { trust: false })).askedForCode).toBe(true);
  });

  it('forgets the remembered devices when an administrator resets the password', async () => {
    const browser = new Browser();
    await signIn(browser);
    expect(await devices()).toHaveLength(1);
    carlaPassword = secret();
    const reset = await admin(`/users/${carlaId}/reset-password`, { method: 'PUT', body: { type: 'password', value: carlaPassword, temporary: false } });
    expect(reset.status).toBe(204);
    expect(await devices()).toHaveLength(0);
    expect((await signIn(browser.withDeviceOnly(), { trust: false })).askedForCode).toBe(true);
  });

  it('keeps at most the policy number of devices, forgetting the least recently used', async () => {
    await setPolicy({ 'solidvs.rememberedDevice.maxDevices': '2' });
    const browsers = [new Browser(), new Browser(), new Browser()];
    for (const browser of browsers) await signIn(browser);
    expect(await devices()).toHaveLength(2);
    expect((await signIn(browsers[0]!.withDeviceOnly(), { trust: false })).askedForCode).toBe(true);
    expect((await signIn(browsers[2]!.withDeviceOnly())).askedForCode).toBe(false);
    await setPolicy(DEFAULT_POLICY);
    await forgetAllDevices();
  });

  it('follows the policy an administrator switches: every sign-in, off, and the strictest value when unreadable', async () => {
    const remembered = new Browser();
    await signIn(remembered);

    await setPolicy({ 'solidvs.secondFactor.mode': 'every-sign-in' });
    expect((await signIn(remembered.withDeviceOnly(), { trust: false })).askedForCode).toBe(true);

    await setPolicy({ 'solidvs.secondFactor.mode': 'off' });
    expect(await signIn(new Browser())).toEqual({ askedForCode: false, acr: 'standard' });
    // Off at sign-in, but a sensitive action still asks for the code.
    expect(await signIn(new Browser(), { acr: 'strong' })).toEqual({ askedForCode: true, acr: 'strong' });

    await setPolicy({ 'solidvs.secondFactor.mode': 'sometimes' });
    expect((await signIn(new Browser(), { trust: false })).askedForCode).toBe(true);

    await setPolicy(DEFAULT_POLICY);
    await forgetAllDevices();
  });
});
