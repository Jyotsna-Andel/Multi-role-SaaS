import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ACCESS_TTL_SECONDS } from './cookies';
import { SessionService } from './session.service';

const JWT_CLAIMS = { issuer: 'saas-api', audience: 'saas-web' };

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        signOptions: { ...JWT_CLAIMS, expiresIn: ACCESS_TTL_SECONDS, algorithm: 'HS256' },
        // Pin the algorithm + claims so tokens minted elsewhere (or alg=none) are rejected.
        verifyOptions: { ...JWT_CLAIMS, algorithms: ['HS256'] },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, SessionService],
  exports: [AuthService, SessionService, JwtModule],
})
export class AuthModule {}
