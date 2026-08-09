import { Module } from '@nestjs/common';
import { USER_SERVICE_TOKEN } from './interfaces/user-service.interface';
import { UserService } from './user.service';
import { WebAuthGuard } from '@/common/guards/web-auth.guard';
import { AppLogger } from '@/common/logger/logger.service';

@Module({
  providers: [
    AppLogger,
    UserService,
    {
      provide: USER_SERVICE_TOKEN,
      useClass: UserService,
    },
    WebAuthGuard,
  ],
  exports: [UserService, USER_SERVICE_TOKEN, WebAuthGuard],
})
export class UsersModule {}
