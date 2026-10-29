import { Transform } from 'class-transformer';
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const normalizeEmail = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);

export const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,72}$/;
export const PASSWORD_MESSAGE = 'Password must be 8-72 chars with upper, lower case letters and a digit';

export class LoginDto {
  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @MaxLength(72)
  password: string;
}

export class RegisterDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  orgName: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(254)
  email: string;

  @Matches(PASSWORD_RULE, { message: PASSWORD_MESSAGE })
  password: string;
}
