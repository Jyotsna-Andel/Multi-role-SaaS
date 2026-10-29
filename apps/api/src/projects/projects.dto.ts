import { ProjectStatus } from '@prisma/client';
import { IsEnum, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PageQueryDto } from '../common/pagination';

export const PROJECT_SORTS = ['newest', 'oldest', 'name'] as const;

export class ListProjectsDto extends PageQueryDto {
  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @IsOptional()
  @IsIn(PROJECT_SORTS)
  sort: (typeof PROJECT_SORTS)[number] = 'newest';
}

export class CreateProjectDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;
}

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;
}
