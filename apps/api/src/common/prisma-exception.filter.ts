import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

/** Maps well-known Prisma errors to HTTP responses instead of leaking 500s. */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(err: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const map: Record<string, [number, string]> = {
      P2002: [HttpStatus.CONFLICT, 'A record with this value already exists'],
      P2025: [HttpStatus.NOT_FOUND, 'Record not found'],
      // Serializable transaction conflict — safe for the client to retry.
      P2034: [HttpStatus.CONFLICT, 'Concurrent update detected, please retry'],
    };
    const [statusCode, message] = map[err.code] ?? [HttpStatus.INTERNAL_SERVER_ERROR, 'Internal server error'];
    res.status(statusCode).json({ statusCode, message });
  }
}
