import { Controller, Get, Global, Module, Query } from '@nestjs/common';
import { IsOptional, IsString, Matches } from 'class-validator';
import { AuthUser } from '../common/auth-user';
import { CurrentUser, RequirePermissions } from '../common/decorators';
import { CursorQueryDto } from '../common/pagination';
import { Permission } from '../common/rbac';
import { AuditService } from './audit.service';

class AuditQueryDto extends CursorQueryDto {
  @IsOptional()
  @IsString()
  @Matches(/^[a-z_.]{1,40}$/)
  action?: string;
}

@Controller('audit-logs')
@RequirePermissions(Permission.AUDIT_READ)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() q: AuditQueryDto) {
    return this.audit.list(user.orgId, q);
  }
}

@Global()
@Module({ controllers: [AuditController], providers: [AuditService], exports: [AuditService] })
export class AuditModule {}
