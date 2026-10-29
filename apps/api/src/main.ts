import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import 'reflect-metadata';
import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './common/prisma-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  const config = app.get(ConfigService);
  const webOrigin = config.getOrThrow<string>('WEB_ORIGIN');

  // The Next.js server proxies /api/* to us from localhost; trust its X-Forwarded-For
  // so rate limits and audit logs see the real client IP.
  app.set('trust proxy', 'loopback');
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(cookieParser());
  app.useBodyParser('json', { limit: '100kb' });
  app.enableCors({ origin: webOrigin, credentials: true });

  // Defence-in-depth CSRF check (on top of SameSite cookies): browsers always send
  // Origin on cross-site unsafe requests, so reject any that isn't our web app.
  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && origin && origin !== webOrigin) {
      return res.status(403).json({ statusCode: 403, message: 'Cross-origin request blocked' });
    }
    next();
  });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip unknown properties
      forbidNonWhitelisted: true, // ...and reject requests that send them (mass-assignment protection)
      transform: true,
    }),
  );
  app.useGlobalFilters(new PrismaExceptionFilter());
  app.enableShutdownHooks();

  const port = config.getOrThrow<number>('PORT');
  await app.listen(port);
  Logger.log(`API listening on http://localhost:${port}/api`, 'Bootstrap');
}

void bootstrap();
