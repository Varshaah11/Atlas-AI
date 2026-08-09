import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AlertStatus, AlertType, StockAlert } from '@prisma/client';
import { CreateAlertDto } from './dto/create-alert.dto';
import { UpdateAlertDto } from './dto/update-alert.dto';
import { AppLogger } from '@/common/logger/logger.service';
import { PrismaService } from '@/database/prisma.service';
import { FinanceService } from '@/finance/finance.service';

const VALID_SEC_FORMS = ['10-K', '10-Q', '8-K'];

@Injectable()
export class AlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly financeService: FinanceService,
    private readonly logger: AppLogger,
  ) {}

  async createAlert(userId: string, dto: CreateAlertDto): Promise<StockAlert> {
    if (!dto.symbol || typeof dto.symbol !== 'string' || dto.symbol.trim().length === 0) {
      throw new BadRequestException('A valid stock symbol or company name is required.');
    }

    const resolvedSymbol = await this.financeService.resolveTicker(dto.symbol);
    const finalSymbol = resolvedSymbol
      ? resolvedSymbol.toUpperCase()
      : dto.symbol.trim().toUpperCase();

    // Validate alert type specific requirements
    if (
      dto.alertType === AlertType.PRICE_ABOVE ||
      dto.alertType === AlertType.PRICE_BELOW ||
      dto.alertType === AlertType.PERCENT_CHANGE_DAILY
    ) {
      if (
        dto.targetValue === undefined ||
        dto.targetValue === null ||
        typeof dto.targetValue !== 'number' ||
        dto.targetValue <= 0
      ) {
        throw new BadRequestException(
          `A positive targetValue is required for ${dto.alertType} alerts.`,
        );
      }
    } else if (dto.alertType === AlertType.NEW_SEC_FILING) {
      if (!dto.secFormType || !VALID_SEC_FORMS.includes(dto.secFormType)) {
        throw new BadRequestException(
          `A valid SEC form type (${VALID_SEC_FORMS.join(', ')}) is required for NEW_SEC_FILING alerts.`,
        );
      }
    } else {
      throw new BadRequestException('Unsupported alert type.');
    }

    const alert = await this.prisma.stockAlert.create({
      data: {
        userId,
        symbol: finalSymbol,
        alertType: dto.alertType,
        targetValue: dto.targetValue ?? null,
        secFormType: dto.secFormType ?? null,
        status: AlertStatus.ACTIVE,
      },
    });

    this.logger.log(
      `Created ${dto.alertType} alert for symbol ${finalSymbol} (User: ${userId}, Alert ID: ${alert.id})`,
      'AlertsService',
    );

    return alert;
  }

  async listAlerts(userId: string): Promise<StockAlert[]> {
    return this.prisma.stockAlert.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateAlert(userId: string, alertId: string, dto: UpdateAlertDto): Promise<StockAlert> {
    const existing = await this.prisma.stockAlert.findFirst({
      where: { id: alertId, userId },
    });

    if (!existing) {
      throw new NotFoundException('Alert not found.');
    }

    // Validate updated fields if provided
    if (dto.targetValue !== undefined && dto.targetValue !== null) {
      if (typeof dto.targetValue !== 'number' || dto.targetValue <= 0) {
        throw new BadRequestException('targetValue must be a positive number.');
      }
    }

    if (dto.secFormType !== undefined && dto.secFormType !== null) {
      if (!VALID_SEC_FORMS.includes(dto.secFormType)) {
        throw new BadRequestException(`secFormType must be one of: ${VALID_SEC_FORMS.join(', ')}.`);
      }
    }

    const updated = await this.prisma.stockAlert.update({
      where: { id: alertId },
      data: {
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.targetValue !== undefined ? { targetValue: dto.targetValue } : {}),
        ...(dto.secFormType !== undefined ? { secFormType: dto.secFormType } : {}),
      },
    });

    this.logger.log(`Updated alert ${alertId} (User: ${userId})`, 'AlertsService');
    return updated;
  }

  async deleteAlert(userId: string, alertId: string): Promise<{ success: boolean; id: string }> {
    const existing = await this.prisma.stockAlert.findFirst({
      where: { id: alertId, userId },
    });

    if (!existing) {
      throw new NotFoundException('Alert not found.');
    }

    await this.prisma.stockAlert.delete({
      where: { id: alertId },
    });

    this.logger.log(`Deleted alert ${alertId} (User: ${userId})`, 'AlertsService');
    return { success: true, id: alertId };
  }
}
