import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthUser, RequestMeta } from '../common/auth-user';
import { CurrentUser, Public, ReqMeta } from '../common/decorators';
import { LoginDto, RegisterDto } from './auth.dto';
import { AuthService } from './auth.service';
import { clearAuthCookies, REFRESH_COOKIE, setAuthCookies } from './cookies';

// Tokens travel only in httpOnly cookies — never in the response body.
@Controller('auth')
export class AuthController {
  private readonly secure: boolean;

  constructor(
    private readonly auth: AuthService,
    config: ConfigService,
  ) {
    this.secure = config.get<boolean>('COOKIE_SECURE') ?? false;
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('register')
  async register(@Body() dto: RegisterDto, @ReqMeta() meta: RequestMeta, @Res({ passthrough: true }) res: Response) {
    const { user, tokens } = await this.auth.register(dto, meta);
    setAuthCookies(res, tokens, this.secure);
    return { user };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(200)
  @Post('login')
  async login(@Body() dto: LoginDto, @ReqMeta() meta: RequestMeta, @Res({ passthrough: true }) res: Response) {
    const { user, tokens } = await this.auth.login(dto, meta);
    setAuthCookies(res, tokens, this.secure);
    return { user };
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @HttpCode(200)
  @Post('refresh')
  async refresh(@Req() req: Request, @ReqMeta() meta: RequestMeta, @Res({ passthrough: true }) res: Response) {
    try {
      const tokens = await this.auth.refresh(req.cookies?.[REFRESH_COOKIE], meta);
      setAuthCookies(res, tokens, this.secure);
      return { ok: true };
    } catch (err) {
      clearAuthCookies(res, this.secure);
      throw err;
    }
  }

  @Public()
  @HttpCode(204)
  @Post('logout')
  async logout(@Req() req: Request, @ReqMeta() meta: RequestMeta, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.cookies?.[REFRESH_COOKIE], req.user, meta);
    clearAuthCookies(res, this.secure);
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }
}
