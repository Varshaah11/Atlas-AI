import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { CreateAlertDto } from './dto/create-alert.dto';
import { UpdateAlertDto } from './dto/update-alert.dto';
import { WebAuthGuard } from '@/common/guards/web-auth.guard';

@Controller('alerts')
@UseGuards(WebAuthGuard)
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Post()
  async createAlert(@Req() req: any, @Body() dto: CreateAlertDto) {
    const userId = req.user.id;
    const alert = await this.alertsService.createAlert(userId, dto);
    return {
      success: true,
      alert,
    };
  }

  @Get()
  async listAlerts(@Req() req: any) {
    const userId = req.user.id;
    const alerts = await this.alertsService.listAlerts(userId);
    return {
      success: true,
      alerts,
    };
  }

  @Patch(':id')
  async updateAlert(@Req() req: any, @Param('id') alertId: string, @Body() dto: UpdateAlertDto) {
    const userId = req.user.id;
    const alert = await this.alertsService.updateAlert(userId, alertId, dto);
    return {
      success: true,
      alert,
    };
  }

  @Delete(':id')
  async deleteAlert(@Req() req: any, @Param('id') alertId: string) {
    const userId = req.user.id;
    const result = await this.alertsService.deleteAlert(userId, alertId);
    return {
      success: true,
      id: result.id,
    };
  }
}
