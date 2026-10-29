import { Role } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PageQueryDto } from '../common/pagination';

export class ListUsersDto extends PageQueryDto {
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}

export class InviteUserDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @IsEnum(Role)
  role: Role;
}

export class UpdateRoleDto {
  @IsEnum(Role)
  role: Role;
}

export class SetActiveDto {
  @IsBoolean()
  isActive: boolean;
}
