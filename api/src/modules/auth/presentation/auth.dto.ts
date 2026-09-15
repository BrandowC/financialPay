import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/**
 * Los DTOs son la PRIMERA barrera: rechazan lo evidentemente malformado antes
 * de que llegue al dominio. Los value objects son la SEGUNDA y validan las
 * reglas de negocio de verdad.
 *
 * Puede parecer duplicado, pero no lo es:
 *   · El DTO protege de payloads absurdos (10 MB de texto, tipos equivocados)
 *     sin gastar CPU, y da errores por campo que el formulario puede pintar.
 *   · El value object protege la regla de negocio y sigue vigente aunque el
 *     caso de uso se invoque desde un worker o un script, sin pasar por HTTP.
 */

export class RegisterDto {
  @ApiProperty({ example: 'María González', maxLength: 120 })
  @IsString()
  @IsNotEmpty({ message: 'fullName es obligatorio' })
  @MaxLength(120)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  fullName!: string;

  @ApiProperty({ example: 'maria@ejemplo.com' })
  @IsString()
  @IsNotEmpty({ message: 'email es obligatorio' })
  @MaxLength(254)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email!: string;

  @ApiProperty({ example: 'una-clave-segura', minLength: 8, maxLength: 128 })
  @IsString()
  @MinLength(8, { message: 'password debe tener al menos 8 caracteres' })
  @MaxLength(128, { message: 'password no puede superar 128 caracteres' })
  // Sin @Transform: recortar espacios cambiaría la contraseña del usuario.
  password!: string;

  @ApiProperty({ example: '1995-08-14', description: 'AAAA-MM-DD. Se exigen 18 años cumplidos.' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'birthDate debe tener el formato AAAA-MM-DD' })
  birthDate!: string;

  @ApiProperty({ example: '3015551234', description: 'Celular de EE. UU., 10 dígitos' })
  @IsString()
  @IsNotEmpty({ message: 'phone es obligatorio' })
  @MaxLength(20)
  phone!: string;
}

export class LoginDto {
  @ApiProperty({
    example: 'María González',
    description: 'Nombre completo o correo. La app acepta ambos.',
  })
  @IsString()
  @IsNotEmpty({ message: 'identifier es obligatorio' })
  @MaxLength(254)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  identifier!: string;

  @ApiProperty({ example: 'una-clave-segura' })
  @IsString()
  @IsNotEmpty({ message: 'password es obligatorio' })
  @MaxLength(128)
  password!: string;
}

export class RefreshDto {
  @ApiProperty({ description: 'El refreshToken entregado al iniciar sesión' })
  @IsString()
  @IsNotEmpty({ message: 'refreshToken es obligatorio' })
  @MaxLength(512)
  refreshToken!: string;
}

export class UpdateBalanceDto {
  @ApiProperty({
    example: '1500.75',
    description:
      'Monto como TEXTO decimal. Se envía como cadena y no como número a ' +
      'propósito: un JSON con 1500.75 se convierte en un double y pierde ' +
      'precisión en montos grandes.',
  })
  @IsString({ message: 'amount debe enviarse como texto, no como número' })
  @Matches(/^\d{1,12}(\.\d{1,2})?$/, {
    message: 'amount debe ser un número positivo con máximo 2 decimales (ej: 1500.75)',
  })
  amount!: string;

  @ApiProperty({
    example: 3,
    description:
      'Versión del saldo que el administrador tenía en pantalla. Si otro ' +
      'administrador guardó primero, la API responde 409 en vez de pisar el cambio.',
  })
  @IsInt({ message: 'expectedVersion debe ser un entero' })
  @Min(0)
  expectedVersion!: number;

  @ApiPropertyOptional({ example: 'Ajuste mensual autorizado', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  reason?: string;
}
