import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuditModule } from './audit/audit.controller';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard, PermissionsGuard } from './common/guards';
import { RedisThrottlerStorage } from './common/redis-throttler.storage';
import { validateEnv } from './config/env';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma/prisma.service';
import { ProjectsModule } from './projects/projects.controller';
import { RedisModule, RedisService } from './redis/redis.service';
import { UsersModule } from './users/users.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    PrismaModule,
    RedisModule,
    ThrottlerModule.forRootAsync({
      inject: [RedisService],
      useFactory: (redis: RedisService) => ({
        // Global default: 100 req/min per client IP. Auth routes override this with stricter limits.
        throttlers: [{ name: 'default', ttl: 60_000, limit: 100 }],
        storage: new RedisThrottlerStorage(redis.client),
      }),
    }),
    AuditModule,
    AuthModule,
    UsersModule,
    ProjectsModule,
  ],
  controllers: [HealthController],
  providers: [
    // Order matters: rate-limit first (cheap), then authenticate, then authorize.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
