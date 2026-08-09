import { Module, Global } from '@nestjs/common';
import { AppLogger } from '@/common/logger/logger.service';
import { PrismaService } from '@/database/prisma.service';

@Global()
@Module({
  providers: [PrismaService, AppLogger],
  exports: [PrismaService, AppLogger],
})
export class DatabaseModule {}
