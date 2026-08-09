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
          const formattedCurrent = `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`;
          this.logger.log(
            `Checking scheduled briefing for user ${config.userId} (Configured time: ${config.preferredTime || '08:00'} UTC, Current time: ${formattedCurrent} UTC)...`,
            'BriefingSchedulerService',
          );

          if (this.isBriefingDue(config, now)) {
            this.logger.log(
              `Scheduled briefing is due for user ${config.userId} (Frequency: ${config.frequency}). Triggering scheduled briefing...`,
              'BriefingSchedulerService',
            );
            const result = await this.briefingsService.triggerNow(config.userId, {
              isScheduled: true,
            });
            this.logger.log(
              `Scheduled briefing delivered successfully for user ${config.userId} (Delivered to Telegram: ${result.deliveredToTelegram})`,
              'BriefingSchedulerService',
            );
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
    if (!config.enabled) {
      this.logger.log(
        `[BriefingSchedulerService] User ${config.userId} | Scheduled briefing is disabled`,
        'BriefingSchedulerService',
      );
      return false;
    }

    // Parse preferredTime ("HH:mm") into UTC hour & minute
    const [targetHourStr, targetMinStr] = (config.preferredTime || '08:00').split(':');
    const targetHour = parseInt(targetHourStr, 10);
    const targetMinute = parseInt(targetMinStr || '0', 10);

    const currentUtcHour = now.getUTCHours();
    const currentUtcMinute = now.getUTCMinutes();
    const currentUtcDay = now.getUTCDay(); // 0 = Sunday, 1 = Monday...

    // Calculate today's scheduled UTC occurrence datetime
    const scheduledOccurrence = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        targetHour,
        targetMinute,
        0,
        0,
      ),
    );

    const formattedCurrent = `${String(currentUtcHour).padStart(2, '0')}:${String(currentUtcMinute).padStart(2, '0')} UTC`;
    const formattedLastDelivered = config.lastDeliveredAt
      ? new Date(config.lastDeliveredAt).toISOString()
      : 'None';
    const formattedScheduled = scheduledOccurrence.toISOString();

    // 1. Check hour match
    if (currentUtcHour !== targetHour) {
      this.logger.log(
        `[BriefingSchedulerService] User ${config.userId} | Preferred: ${config.preferredTime} UTC | Current: ${formattedCurrent} | Scheduled window: ${formattedScheduled} | Last delivered: ${formattedLastDelivered} | Due: false | Reason: Current UTC hour (${currentUtcHour}) does not match target hour (${targetHour})`,
        'BriefingSchedulerService',
      );
      return false;
    }

    // 2. Check 15-minute slot match
    const targetSlot = Math.floor(targetMinute / 15) * 15;
    const currentSlot = Math.floor(currentUtcMinute / 15) * 15;

    if (currentSlot !== targetSlot) {
      this.logger.log(
        `[BriefingSchedulerService] User ${config.userId} | Preferred: ${config.preferredTime} UTC | Current: ${formattedCurrent} | Scheduled window: ${formattedScheduled} | Last delivered: ${formattedLastDelivered} | Due: false | Reason: Current 15-minute window (${currentSlot}m) does not match target window (${targetSlot}m)`,
        'BriefingSchedulerService',
      );
      return false;
    }

    // 3. Day check for weekly Monday frequency
    if (config.frequency === BriefingFrequency.WEEKLY_MONDAY && currentUtcDay !== 1) {
      this.logger.log(
        `[BriefingSchedulerService] User ${config.userId} | Preferred: ${config.preferredTime} UTC | Current: ${formattedCurrent} | Scheduled window: ${formattedScheduled} | Last delivered: ${formattedLastDelivered} | Due: false | Reason: WEEKLY_MONDAY requires Monday (Current UTC day: ${currentUtcDay})`,
        'BriefingSchedulerService',
      );
      return false;
    }

    // 4. Check if today's scheduled occurrence has already been delivered
    if (config.lastDeliveredAt) {
      const lastDeliveredTime = new Date(config.lastDeliveredAt).getTime();
      if (lastDeliveredTime >= scheduledOccurrence.getTime()) {
        this.logger.log(
          `[BriefingSchedulerService] User ${config.userId} | Preferred: ${config.preferredTime} UTC | Current: ${formattedCurrent} | Scheduled window: ${formattedScheduled} | Last delivered: ${formattedLastDelivered} | Due: false | Reason: Scheduled briefing already delivered for today's scheduled window`,
          'BriefingSchedulerService',
        );
        return false;
      }
    }

    this.logger.log(
      `[BriefingSchedulerService] User ${config.userId} | Preferred: ${config.preferredTime} UTC | Current: ${formattedCurrent} | Scheduled window: ${formattedScheduled} | Last delivered: ${formattedLastDelivered} | Due: true`,
      'BriefingSchedulerService',
    );
    return true;
  }
}
