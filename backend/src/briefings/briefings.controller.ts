import { Body, Controller, Get, Post, Put, Req, UseGuards } from '@nestjs/common';
import { BriefingsService } from './briefings.service';
import { UpdateBriefingConfigDto } from './dto/update-briefing-config.dto';
import { WebAuthGuard } from '@/common/guards/web-auth.guard';

@Controller('briefings')
@UseGuards(WebAuthGuard)
export class BriefingsController {
  constructor(private readonly briefingsService: BriefingsService) {}

  @Get('config')
  async getConfig(@Req() req: any) {
    const userId = req.user.id;
    const config = await this.briefingsService.getConfig(userId);
    const telegramConnected =
      (typeof req.user.telegramChatId === 'string' && req.user.telegramChatId.trim().length > 0) ||
      (typeof req.user.telegramId === 'string' && !req.user.telegramId.startsWith('web-'));
    return {
      success: true,
      config,
      telegramConnected,
    };
  }

  @Put('config')
  async updateConfig(@Req() req: any, @Body() dto: UpdateBriefingConfigDto) {
    const userId = req.user.id;
    const config = await this.briefingsService.updateConfig(userId, dto);
    return {
      success: true,
      config,
    };
  }

  @Post('trigger-now')
  async triggerNow(@Req() req: any) {
    const userId = req.user.id;
    const result = await this.briefingsService.triggerNow(userId);
    return {
      success: true,
      briefing: result.briefing,
      deliveredToTelegram: result.deliveredToTelegram,
      config: result.config,
    };
  }

  @Get('history')
  async getHistory(@Req() req: any) {
    const userId = req.user.id;
    const history = await this.briefingsService.getHistory(userId);
    return {
      success: true,
      history,
    };
  }
}
