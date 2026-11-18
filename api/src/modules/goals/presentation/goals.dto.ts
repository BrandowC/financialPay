import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

const MONEY_MESSAGE = 'Escribe un monto válido, solo números y máximo 2 decimales (ej: 1500.75)';

export class CreateGoalDto {
  @ApiProperty({ example: 'Viaje a Cartagena', maxLength: 80 })
  @IsString()
  @IsNotEmpty({ message: 'name es obligatorio' })
  @MaxLength(80)
  @Transform(trim)
  name!: string;

  @ApiPropertyOptional({ example: '✈️', description: 'Un emoji para reconocer la meta' })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  emoji?: string;

  @ApiProperty({
    example: '2500000',
    description:
      'Cuánto quieres juntar, como TEXTO decimal. Se envía como cadena y no como ' +
      'número para no perder precisión.',
  })
  @IsString({ message: 'targetAmount debe enviarse como texto' })
  @Matches(/^[\d.,\s]{1,24}$/, { message: MONEY_MESSAGE })
  targetAmount!: string;

  @ApiProperty({ example: 'COP', description: 'Moneda ISO-4217 de la meta' })
  @IsString()
  @Matches(/^[A-Z]{3}$/, { message: 'currency debe ser un código de 3 letras mayúsculas' })
  currency!: string;

  @ApiPropertyOptional({ example: '2027-06-30', description: 'Fecha límite, AAAA-MM-DD' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'deadline debe tener el formato AAAA-MM-DD' })
  deadline?: string;
}

export class UpdateGoalDto {
  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'name no puede estar vacío' })
  @MaxLength(80)
  @Transform(trim)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(8)
  emoji?: string;

  @ApiPropertyOptional({ example: '3000000' })
  @IsOptional()
  @IsString({ message: 'targetAmount debe enviarse como texto' })
  @Matches(/^[\d.,\s]{1,24}$/, { message: MONEY_MESSAGE })
  targetAmount?: string;

  @ApiPropertyOptional({
    example: '2027-06-30',
    nullable: true,
    description: 'AAAA-MM-DD, o null para quitar la fecha límite',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'deadline debe tener el formato AAAA-MM-DD' })
  deadline?: string | null;

  @ApiPropertyOptional({ description: 'true archiva la meta, false la reactiva' })
  @IsOptional()
  @IsBoolean()
  archived?: boolean;
}

export class AddContributionDto {
  @ApiProperty({ example: '150000', description: 'Monto como TEXTO decimal, siempre positivo' })
  @IsString({ message: 'amount debe enviarse como texto' })
  @Matches(/^[\d.,\s]{1,24}$/, { message: MONEY_MESSAGE })
  amount!: string;

  @ApiProperty({ enum: ['deposit', 'withdrawal'], description: 'Aporte o retiro' })
  @IsIn(['deposit', 'withdrawal'])
  type!: 'deposit' | 'withdrawal';

  @ApiPropertyOptional({ example: 'Prima de diciembre', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(trim)
  note?: string;

  @ApiPropertyOptional({ example: '2026-11-17', description: 'Fecha del aporte; por defecto hoy' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'madeOn debe tener el formato AAAA-MM-DD' })
  madeOn?: string;
}
