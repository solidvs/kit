import { InvalidServiceTokenError, type ServiceCaller, type ServiceTokenVerifier } from '../service/service-token.js';

/** Service tokens for tests: `issue(clientId)` returns a token this verifier accepts. */
export class FakeServiceTokenVerifier implements ServiceTokenVerifier {
  private readonly tokens = new Map<string, string>();

  issue(clientId: string): string {
    const token = `fake-service-token-${this.tokens.size + 1}`;
    this.tokens.set(token, clientId);
    return token;
  }

  async verify(token: string): Promise<ServiceCaller> {
    const clientId = this.tokens.get(token);
    if (!clientId) throw new InvalidServiceTokenError('unknown token');
    return { clientId };
  }
}
