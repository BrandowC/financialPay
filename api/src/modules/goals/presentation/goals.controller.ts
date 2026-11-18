import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  AuthenticatedRequest,
  RequireCustomer,
} from '../../../shared/infrastructure/http/auth.guard';
import { GoalsService, SUPPORTED_CURRENCIES } from '../application/goals.service';
import { AddContributionDto, CreateGoalDto, UpdateGoalDto } from './goals.dto';

/**
 * Las metas de ahorro de quien tiene la sesión abierta.
 *
 * Igual que `MeController`: el id de la persona sale de `request.principal.id`
 * (el token), nunca de la URL. Aquí solo viajan ids de META, y el servicio
 * comprueba en cada consulta que esa meta es de quien pregunta.
 */
@ApiTags('Metas')
@Controller('me/goals')
@RequireCustomer()
export class GoalsController {
  constructor(private readonly goals: GoalsService) {}

  @Get()
  @ApiOperation({ summary: 'Mis metas, con lo ahorrado y el avance de cada una' })
  async list(@Req() request: AuthenticatedRequest) {
    const goals = await this.goals.list(request.principal!.id);
    return { success: true, data: { goals, currencies: SUPPORTED_CURRENCIES } };
  }

  @Post()
  @Throttle({ createGoal: { limit: 30, ttl: 3_600_000 } })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear una meta' })
  async create(@Body() dto: CreateGoalDto, @Req() request: AuthenticatedRequest) {
    const goal = await this.goals.create(request.principal!.id, dto);
    return { success: true, data: goal };
  }

  @Get(':goalId')
  @ApiOperation({ summary: 'Una meta con su historial de aportes' })
  @ApiResponse({ status: 404, description: 'La meta no existe o no es tuya' })
  async detail(
    @Param('goalId', ParseUUIDPipe) goalId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return { success: true, data: await this.goals.get(request.principal!.id, goalId) };
  }

  @Patch(':goalId')
  @ApiOperation({ summary: 'Editar, archivar o reactivar una meta' })
  async update(
    @Param('goalId', ParseUUIDPipe) goalId: string,
    @Body() dto: UpdateGoalDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return { success: true, data: await this.goals.update(request.principal!.id, goalId, dto) };
  }

  @Delete(':goalId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar una meta y todos sus aportes' })
  async remove(
    @Param('goalId', ParseUUIDPipe) goalId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    await this.goals.remove(request.principal!.id, goalId);
  }

  @Post(':goalId/contributions')
  @Throttle({ addContribution: { limit: 120, ttl: 3_600_000 } })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registrar un aporte o un retiro' })
  @ApiResponse({ status: 400, description: 'Retiro mayor a lo ahorrado, monto inválido…' })
  async addContribution(
    @Param('goalId', ParseUUIDPipe) goalId: string,
    @Body() dto: AddContributionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return {
      success: true,
      data: await this.goals.addContribution(request.principal!.id, goalId, dto),
    };
  }

  @Delete(':goalId/contributions/:contributionId')
  @ApiOperation({ summary: 'Borrar un aporte o retiro' })
  async removeContribution(
    @Param('goalId', ParseUUIDPipe) goalId: string,
    @Param('contributionId', ParseUUIDPipe) contributionId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return {
      success: true,
      data: await this.goals.removeContribution(request.principal!.id, goalId, contributionId),
    };
  }
}
