import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/** Offset pagination — good for UIs with page numbers and totals. */
export class PageQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 10;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

export interface Paginated<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export function paginated<T>(data: T[], total: number, page: number, limit: number): Paginated<T> {
  return { data, meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } };
}

/** Cursor pagination — stable under inserts, O(1) per page; good for feeds/logs. */
export class CursorQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}

export interface CursorPage<T> {
  data: T[];
  nextCursor: string | null;
}
