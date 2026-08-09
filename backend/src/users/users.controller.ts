import { Controller, Get, Inject, Post, Req, UseGuards } from '@nestjs/common';
import { IUserService, USER_SERVICE_TOKEN } from './interfaces/user-service.interface';
import { WebAuthGuard } from '@/common/guards/web-auth.guard';

@Controller('users')
@UseGuards(WebAuthGuard)
export class UsersController {
  constructor(@Inject(USER_SERVICE_TOKEN) private readonly userService: IUserService) {}

  @Get('me')
  async getProfile(@Req() req: any) {
    const telegramConnected =
      (typeof req.user.telegramChatId === 'string' && req.user.telegramChatId.trim().length > 0) ||
      (typeof req.user.telegramId === 'string' && !req.user.telegramId.startsWith('web-'));
    return {
      success: true,
      user: {
        id: req.user.id,
        username: req.user.username,
        telegramConnected,
      },
    };
  }

  @Post('telegram-link')
  async createTelegramLink(@Req() req: any) {
    const result = await this.userService.createTelegramLinkToken(req.user.id);
    return {
      success: true,
      linkUrl: result.linkUrl,
      expiresAt: result.expiresAt.toISOString(),
    };
  }
}
