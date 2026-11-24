import 'reflect-metadata';

import { Controller, Get, Post, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { platformConfigSchema } from '../config/load-config.js';
import { FakeIdentityProvider } from '../testing/fake-identity-provider.js';
import { configurePlatformApp } from './configure-app.js';
import type { ServiceCaller } from '../service/service-token.js';
import { FakeServiceTokenVerifier } from '../testing/fake-service-token-verifier.js';
import { CurrentService, RequireRoles, ServiceRoute } from './decorators.js';
import { PlatformModule } from './platform.module.js';

@Controller('things')
class ThingsController {
  @Get()
  list(): string[] {
    return ['a'];
  }

  @Post()
  @RequireRoles('admin')
  create(): { created: true } {
    return { created: true };
  }
}

@Controller('feed')
class FeedController {
  @Get()
  @ServiceRoute()
  feed(@CurrentService() caller: ServiceCaller): { for: string } {
    return { for: caller.clientId };
  }
}

const IT_ADMIN = { sub: 's-1', preferred_username: 'ana', name: 'Ana', department: 'TI', groups: ['GRP-Portal-Admins'] };
const PUBLIC_URL = 'https://portal.example.com';

/** Extracts `name=value` of a Set-Cookie header. */
function cookie(response: request.Response, name: string): string | undefined {
  const header = response.headers['set-cookie'] as unknown as string[] | undefined;
  return header?.find((c) => c.startsWith(`${name}=`))?.split(';')[0];
}

describe('PlatformModule over HTTP', () => {
  let app: INestApplication;
  let provider: FakeIdentityProvider;
  let services: FakeServiceTokenVerifier;

  beforeEach(async () => {
    provider = new FakeIdentityProvider();
    services = new FakeServiceTokenVerifier();
    const config = platformConfigSchema.parse({
      PUBLIC_URL,
      OIDC_ISSUER: 'https://id.example.test/realms/internal',
      OIDC_CLIENT_ID: 'portal',
      OIDC_CLIENT_SECRET: 'secret',
      LOG_LEVEL: 'fatal',
    });
    const moduleRef = await Test.createTestingModule({
      imports: [PlatformModule.forRoot({ system: 'portal', config, access: { departments: ['TI'] }, roles: { admin: { groups: ['GRP-Portal-Admins'] } }, identityProvider: provider, serviceTokenVerifier: services })],
      controllers: [ThingsController, FeedController],
    }).compile();
    app = moduleRef.createNestApplication();
    configurePlatformApp(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  async function signIn(claims: Record<string, unknown>) {
    provider.signInAs(claims);
    const login = await request(app.getHttpServer()).get('/api/auth/login?returnTo=/projetos');
    expect(login.status).toBe(302);
    const loginCookie = cookie(login, '__Host-login');
    const callback = new URL(login.headers.location as string);
    const response = await request(app.getHttpServer())
      .get(`${callback.pathname}${callback.search}`)
      .set('Cookie', loginCookie ?? '');
    return { response, session: cookie(response, '__Host-session') };
  }

  it('serves health without a session', async () => {
    await request(app.getHttpServer()).get('/api/health').expect(200, { status: 'ok' });
  });

  it('requires a session everywhere else', async () => {
    await request(app.getHttpServer()).get('/api/things').expect(401);
    await request(app.getHttpServer()).get('/api/auth/me').expect(401);
  });

  it('sends the browser to the provider with PKCE and a host-only login cookie', async () => {
    const login = await request(app.getHttpServer()).get('/api/auth/login');
    expect(login.headers['set-cookie']?.[0]).toMatch(/^__Host-login=.+; Max-Age=600; Path=\/; .*HttpOnly; Secure; SameSite=Lax/);
  });

  it('signs in, returns to the page and exposes no token', async () => {
    const { response, session } = await signIn(IT_ADMIN);
    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('/projetos');
    expect(session).toBeDefined();

    const me = await request(app.getHttpServer()).get('/api/auth/me').set('Cookie', session!).expect(200);
    expect(me.body).toMatchObject({
      user: { username: 'ana', name: 'Ana', department: 'TI' },
      roles: ['admin'],
      access: { by: 'department', value: 'TI' },
    });
    expect(JSON.stringify(me.body)).not.toMatch(/refresh-token|id-token/);
    await request(app.getHttpServer()).get('/api/things').set('Cookie', session!).expect(200, ['a']);
  });

  it('sends people outside the rule to the no-access page, without a session', async () => {
    const { response, session } = await signIn({ ...IT_ADMIN, department: 'Vendas' });
    expect(response.headers.location).toBe('/sem-acesso');
    expect(session).toBeUndefined();
  });

  it('refuses state-changing requests without the CSRF token or from another origin', async () => {
    const { session } = await signIn(IT_ADMIN);
    const me = await request(app.getHttpServer()).get('/api/auth/me').set('Cookie', session!);
    const token = me.body.csrfToken as string;

    await request(app.getHttpServer()).post('/api/things').set('Cookie', session!).expect(403);
    await request(app.getHttpServer()).post('/api/things').set('Cookie', session!).set('x-csrf-token', 'wrong').expect(403);
    await request(app.getHttpServer())
      .post('/api/things')
      .set('Cookie', session!)
      .set('x-csrf-token', token)
      .set('Origin', 'https://evil.example')
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/things')
      .set('Cookie', session!)
      .set('x-csrf-token', token)
      .set('Origin', PUBLIC_URL)
      .expect(201, { created: true });
  });

  it('reserves routes to role holders', async () => {
    const { session } = await signIn({ ...IT_ADMIN, groups: [] });
    const me = await request(app.getHttpServer()).get('/api/auth/me').set('Cookie', session!);
    await request(app.getHttpServer())
      .post('/api/things')
      .set('Cookie', session!)
      .set('x-csrf-token', me.body.csrfToken as string)
      .expect(403);
  });

  it('logs out: session gone, provider logout URL returned', async () => {
    const { session } = await signIn(IT_ADMIN);
    const me = await request(app.getHttpServer()).get('/api/auth/me').set('Cookie', session!);
    const logout = await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Cookie', session!)
      .set('x-csrf-token', me.body.csrfToken as string)
      .expect(200);
    expect(logout.body.redirectUrl).toContain('https://id.example.test/logout');
    await request(app.getHttpServer()).get('/api/auth/me').set('Cookie', session!).expect(401);
  });

  it('sends the security headers', async () => {
    const response = await request(app.getHttpServer()).get('/api/health');
    expect(response.headers['content-security-policy']).toContain("connect-src 'self'");
    expect(response.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(response.headers['strict-transport-security']).toContain('max-age=31536000');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });
  it('service routes: a system with a valid token, never a person', async () => {
    const token = services.issue('orders');
    await request(app.getHttpServer()).get('/api/feed').set('Authorization', `Bearer ${token}`).expect(200, { for: 'orders' });
    await request(app.getHttpServer()).get('/api/feed').expect(401);
    await request(app.getHttpServer()).get('/api/feed').set('Authorization', 'Bearer forged').expect(401);
    await request(app.getHttpServer()).get('/api/feed').set('Authorization', `Basic ${token}`).expect(401);
    const { session } = await signIn(IT_ADMIN);
    await request(app.getHttpServer()).get('/api/feed').set('Cookie', session!).expect(401);
  });
});
