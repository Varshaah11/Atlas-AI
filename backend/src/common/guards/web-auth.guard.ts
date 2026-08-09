import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { IUserService, USER_SERVICE_TOKEN } from '@/users/interfaces/user-service.interface';

/**
 * WebAuthGuard enforces authentication on HTTP API routes.
 * It extracts identity from standard request headers (`x-user-id` or `Authorization: Bearer <token>`)
 * and resolves the identity to an actual database User record.
 */
@Injectable()
export class WebAuthGuard implements CanActivate {
  constructor(@Inject(USER_SERVICE_TOKEN) private readonly userService: IUserService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const authHeader = request.headers['authorization'];
    const customUserHeader = request.headers['x-user-id'];

    let rawToken: string | null = null;

    if (typeof customUserHeader === 'string' && customUserHeader.trim()) {
      rawToken = customUserHeader.trim();
    } else if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      rawToken = authHeader.substring(7).trim();
    }

    if (!rawToken) {
      throw new UnauthorizedException(
        'Authentication header required (x-user-id or Authorization Bearer token)',
      );
    }

    const cleanToken = rawToken.replace(/[^a-zA-Z0-9_-]/g, '');

    if (!cleanToken) {
      throw new UnauthorizedException('Invalid authentication credentials');
    }

    const telegramId = cleanToken.startsWith('web-') ? cleanToken : `web-${cleanToken}`;

    const user = await this.userService.getOrCreateUser({
      telegramId,
      username: `user_${cleanToken}`,
      firstName: 'WebUser',
    });

    request.user = user;
    return true;
  }
}
