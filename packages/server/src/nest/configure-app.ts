import type { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import type { Express, NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import type { Logger } from 'pino';

import { PinoNestLogger } from '../logging/logger.js';
import { AUDIT_LOGGER, type PlatformRequest } from './tokens.js';

/**
 * Applies the platform's HTTP baseline to a NestJS application on Express. Call it before
 * `app.listen()`. Routes live under `/api`; the system's single-page application is served on the
 * same origin.
 */
export function configurePlatformApp(app: INestApplication): void {
  const logger = app.get<Logger>(AUDIT_LOGGER);
  app.useLogger(new PinoNestLogger(logger));
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();

  const express = app.getHttpAdapter().getInstance() as Express;
  express.disable('x-powered-by');
  // The only way in is the platform's tunnel (no published port), which connects from inside the
  // environment network.
  express.set('trust proxy', true);

  app.use(cookieParser());
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          // The design system's navigation injects small style elements at runtime (prototype
          // finding 7) and components set inline style attributes.
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          fontSrc: ["'self'"],
          // Nothing but this origin: the design system bundles a feature-flag client that must
          // never be able to call out (prototype finding 6).
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
        },
      },
      strictTransportSecurity: { maxAge: 31_536_000, includeSubDomains: true },
      referrerPolicy: { policy: 'same-origin' },
      crossOriginOpenerPolicy: { policy: 'same-origin' },
    }),
  );

  // One structured line per request: no query string (it may carry authorization codes), no body.
  app.use((req: Request, res: Response, next: NextFunction) => {
    const started = process.hrtime.bigint();
    res.on('finish', () => {
      const session = (req as PlatformRequest).platformSession;
      logger.info(
        {
          event: 'http.request',
          method: req.method,
          path: req.originalUrl.split('?')[0],
          status: res.statusCode,
          ms: Number((process.hrtime.bigint() - started) / 1_000_000n),
          ...(session ? { subject: session.principal.subject } : {}),
        },
        'request',
      );
    });
    next();
  });
}
