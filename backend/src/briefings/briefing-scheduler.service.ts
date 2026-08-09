import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BriefingFrequency, ScheduledBriefing } from '@prisma/client';
import { BriefingsService } from './briefings.service';
import { AppLogger } from '@/common/logger/logger.service';
import { PrismaService } from '@/database/prisma.service';

@Injectable()
export class BriefingSchedulerService {
  private isRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly briefingsService: BriefingsService,
    private readonly logger: AppLogger,
  ) {}

  @Cron('*/15 * * * *')
  async evaluateBriefingSchedules(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn(
        'Briefing scheduler evaluation already in progress, skipping tick.',
        'BriefingSchedulerService',
      );
      return;
    }

    this.isRunning = true;
    try {
      this.logger.log(
        'Starting 15-minute briefing schedule check sweep...',
        'BriefingSchedulerService',
      );

      const activeConfigs = await this.prisma.scheduledBriefing.findMany({
        where: { enabled: true },
      });

      if (!activeConfigs || activeConfigs.length === 0) {
        this.logger.log(
          'No enabled scheduled briefing configurations found.',
          'BriefingSchedulerService',
        );
        return;
      }

      const now = new Date();

      for (const config of activeConfigs) {
        try {
          if (this.isBriefingDue(config, now)) {
            this.logger.log(
              `Briefing due for user ${config.userId} (Frequency: ${config.frequency}). Triggering...`,
              'BriefingSchedulerService',
            );
            await this.briefingsService.triggerNow(config.userId);
          }
        } catch (err: any) {
          this.logger.error(
            `Failed executing scheduled briefing for user ${config.userId}: ${err.message}`,
            err.stack,
            'BriefingSchedulerService',
          );
        }
      }
    } catch (error: any) {
      this.logger.error(
        `Critical error during briefing schedule evaluation sweep: ${error.message}`,
        error.stack,
        'BriefingSchedulerService',
      );
    } finally {
      this.isRunning = false;
    }
  }

  public isBriefingDue(config: ScheduledBriefing, now: Date): boolean {
    if (!config.enabled) return false;

    // Parse preferredTime ("HH:mm") into UTC hour
    const [targetHourStr] = (config.preferredTime || '08:00').split(':');
    const targetHour = parseInt(targetHourStr, 10);
    const currentUtcHour = now.getUTCHours();
    const currentUtcDay = now.getUTCDay(); // 0 = Sunday, 1 = Monday...

    // 1. Check hour match
    if (currentUtcHour !== targetHour) {
      return false;
    }

    // 2. Frequency specific day check
    if (config.frequency === BriefingFrequency.WEEKLY_MONDAY) {
      if (currentUtcDay !== 1) {
        // 1 = Monday
        return false;
      }
    }

    // 3. Duplicate delivery protection using lastDeliveredAt
    if (config.lastDeliveredAt) {
      const lastDelivered = new Date(config.lastDeliveredAt);

      if (
        config.frequency === BriefingFrequency.DAILY_MORNING ||
        config.frequency === BriefingFrequency.DAILY_EVENING
      ) {
        // Daily duplicate check: Compare UTC date YYYY-MM-DD
        const isSameUtcDate =
          now.getUTCFullYear() === lastDelivered.getUTCFullYear() &&
          now.getUTCMonth() === lastDelivered.getUTCMonth() &&
          now.getUTCDate() === lastDelivered.getUTCDate();

        if (isSameUtcDate) {
          return false; // Already delivered today
        }
      } else if (config.frequency === BriefingFrequency.WEEKLY_MONDAY) {
        // Weekly duplicate check: Within last 6 days
        const diffMs = now.getTime() - lastDelivered.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);

        if (diffDays < 6) {
          return false; // Already delivered this week
        }
      }
    }

    return true;
  }
}
