import { Module } from '@nestjs/common';
import { MEMORY_SERVICE_TOKEN } from './interfaces/memory.interface';
import { MemoryService } from './memory.service';
import { AppLogger } from '@/common/logger/logger.service';
import { DatabaseModule } from '@/database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [
    AppLogger,
    MemoryService,
    {
      provide: MEMORY_SERVICE_TOKEN,
      useExisting: MemoryService,
    },
  ],
  exports: [MemoryService, MEMORY_SERVICE_TOKEN],
})
export class MemoryModule {}
