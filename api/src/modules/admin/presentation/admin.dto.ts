import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class AdminLoginDto {
  @ApiProperty({ example: 'admin@amcuenta.com' })
  @IsString()
  @IsNotEmpty({ message: 'email es obligatorio' })
  @MaxLength(254)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'password es obligatorio' })
  @MaxLength(128)
  password!: string;
}

/**
 * Parámetros del listado.
 *
 * ── Los topes no son decorativos ────────────────────────────────────────────
 * Sin `@Max(100)` en pageSize, cualquiera con sesión de administrador podría
 * pedir `?pageSize=1000000` y hacer que Postgres materialice la tabla entera en
 * memoria. Un solo administrador despistado tumbaría la API. Es el caso clásico
 * de denegación de servicio por parámetro sin acotar.
 *
 * `sortBy` va con `@IsIn` sobre una lista cerrada porque su valor termina
 * formando parte de un ORDER BY. Sin esa lista blanca sería inyección SQL
 * directa.
 */
export class ListCustomersDto {
  @ApiPropertyOptional({ description: 'Busca en nombre, correo, cuenta y teléfono' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : undefined))
  search?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 25, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 25;

  @ApiPropertyOptional({ enum: ['registeredAt', 'fullName', 'amountCents'], default: 'registeredAt' })
  @IsOptional()
  @IsIn(['registeredAt', 'fullName', 'amountCents'])
  sortBy: 'registeredAt' | 'fullName' | 'amountCents' = 'registeredAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir: 'asc' | 'desc' = 'desc';

  @ApiPropertyOptional({ description: 'Solo clientes con saldo mayor que cero' })
  @IsOptional()
  // Los query params llegan siempre como texto: "true" no es true.
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  onlyWithBalance?: boolean;

  @ApiPropertyOptional({ description: 'Solo clientes con saldo en cero' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  onlyWithoutBalance?: boolean;

  @ApiPropertyOptional({
    enum: ['today'],
    description: 'Atajo para "solo quienes se registraron hoy"',
  })
  @IsOptional()
  @IsIn(['today'])
  period?: 'today';
}
