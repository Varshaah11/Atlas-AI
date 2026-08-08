import { Injectable } from '@nestjs/common';
import { IMemoryService, UserMemoryData, UserPreferenceData } from './interfaces/memory.interface';
import { AppLogger } from '@/common/logger/logger.service';
import { PrismaService } from '@/database/prisma.service';

@Injectable()
export class MemoryService implements IMemoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: AppLogger,
  ) {}

  async getUserPreferences(userId: string): Promise<UserPreferenceData | null> {
    try {
      const pref = await this.prisma.userPreference.findUnique({
        where: { userId },
      });
      return pref;
    } catch (error: any) {
      this.logger.error(
        `Failed to fetch user preferences for user ${userId}: ${error.message}`,
        error.stack,
        'MemoryService',
      );
      return null;
    }
  }

  async updateUserPreferences(
    userId: string,
    data: Partial<Omit<UserPreferenceData, 'id' | 'userId'>>,
  ): Promise<UserPreferenceData> {
    try {
      const existing = await this.getUserPreferences(userId);

      const investmentStyle =
        data.investmentStyle !== undefined ? data.investmentStyle : existing?.investmentStyle;
      const riskTolerance =
        data.riskTolerance !== undefined ? data.riskTolerance : existing?.riskTolerance;
      const preferredMarket =
        data.preferredMarket !== undefined ? data.preferredMarket : existing?.preferredMarket;

      // Merge and deduplicate tickers & sectors
      let preferredSectors = existing?.preferredSectors || [];
      if (data.preferredSectors && data.preferredSectors.length > 0) {
        preferredSectors = Array.from(
          new Set([
            ...preferredSectors,
            ...data.preferredSectors.map((s) => s.trim().toLowerCase()),
          ]),
        );
      }

      let preferredTickers = existing?.preferredTickers || [];
      if (data.preferredTickers && data.preferredTickers.length > 0) {
        preferredTickers = Array.from(
          new Set([
            ...preferredTickers,
            ...data.preferredTickers.map((t) => t.trim().toUpperCase()),
          ]),
        );
      }

      const updated = await this.prisma.userPreference.upsert({
        where: { userId },
        create: {
          userId,
          investmentStyle,
          riskTolerance,
          preferredSectors,
          preferredTickers,
          preferredMarket,
        },
        update: {
          investmentStyle,
          riskTolerance,
          preferredSectors,
          preferredTickers,
          preferredMarket,
        },
      });

      this.logger.log(`Updated preferences for User ${userId}`, 'MemoryService');
      return updated;
    } catch (error: any) {
      this.logger.error(
        `Failed to update user preferences for user ${userId}: ${error.message}`,
        error.stack,
        'MemoryService',
      );
      throw error;
    }
  }

  async getUserMemories(userId: string): Promise<UserMemoryData[]> {
    try {
      const memories = await this.prisma.userMemory.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        take: 20,
      });
      return memories;
    } catch (error: any) {
      this.logger.error(
        `Failed to fetch memories for user ${userId}: ${error.message}`,
        error.stack,
        'MemoryService',
      );
      return [];
    }
  }

  async saveMemory(
    userId: string,
    memoryText: string,
    category = 'PROFILE',
    importance = 0.5,
  ): Promise<UserMemoryData | null> {
    const cleanText = memoryText.trim().replace(/\s+/g, ' ');
    if (!cleanText || cleanText.length < 5) {
      return null;
    }

    try {
      const existingMemories = await this.getUserMemories(userId);

      // Lightweight duplicate prevention via normalized text matching
      const normalizedNew = cleanText.toLowerCase();
      const duplicate = existingMemories.find((m) => {
        const normExisting = m.memory.toLowerCase();
        return (
          normExisting === normalizedNew ||
          normExisting.includes(normalizedNew) ||
          normalizedNew.includes(normExisting)
        );
      });

      if (duplicate) {
        // Touch updatedAt timestamp and importance on duplicate rather than inserting a duplicate record
        const updated = await this.prisma.userMemory.update({
          where: { id: duplicate.id },
          data: {
            importance: Math.max(duplicate.importance, importance),
            updatedAt: new Date(),
          },
        });
        this.logger.log(
          `Prevented duplicate memory. Updated existing memory ID ${duplicate.id} for User ${userId}`,
          'MemoryService',
        );
        return updated;
      }

      const created = await this.prisma.userMemory.create({
        data: {
          userId,
          memory: cleanText,
          category: category.toUpperCase(),
          importance,
        },
      });

      this.logger.log(
        `Saved new memory [ID: ${created.id}] [Category: ${category}] for User ${userId}`,
        'MemoryService',
      );
      return created;
    } catch (error: any) {
      this.logger.error(
        `Failed to save memory for user ${userId}: ${error.message}`,
        error.stack,
        'MemoryService',
      );
      return null;
    }
  }

  async deleteMemory(memoryId: string): Promise<boolean> {
    try {
      await this.prisma.userMemory.delete({
        where: { id: memoryId },
      });
      return true;
    } catch {
      return false;
    }
  }

  async buildMemoryPromptContext(userId: string): Promise<string> {
    try {
      const [pref, memories] = await Promise.all([
        this.getUserPreferences(userId),
        this.getUserMemories(userId),
      ]);

      const hasPref =
        pref &&
        (pref.investmentStyle ||
          pref.riskTolerance ||
          (pref.preferredSectors && pref.preferredSectors.length > 0) ||
          (pref.preferredTickers && pref.preferredTickers.length > 0));

      const hasMemories = memories && memories.length > 0;

      if (!hasPref && !hasMemories) {
        return '';
      }

      const lines: string[] = [];
      lines.push('[USER PREFERENCES & LONG-TERM MEMORY]');

      if (pref) {
        if (pref.investmentStyle) lines.push(`Investment Style: ${pref.investmentStyle}`);
        if (pref.riskTolerance) lines.push(`Risk Tolerance: ${pref.riskTolerance}`);
        if (pref.preferredSectors && pref.preferredSectors.length > 0) {
          lines.push(`Preferred Sectors: ${pref.preferredSectors.join(', ')}`);
        }
        if (pref.preferredTickers && pref.preferredTickers.length > 0) {
          lines.push(`Preferred Tickers: ${pref.preferredTickers.join(', ')}`);
        }
      }

      if (hasMemories) {
        lines.push('User Insights & Facts:');
        memories.forEach((mem) => {
          lines.push(`- ${mem.memory}`);
        });
      }

      return lines.join('\n');
    } catch (error: any) {
      this.logger.error(
        `Failed to build memory prompt context for user ${userId}: ${error.message}`,
        error.stack,
        'MemoryService',
      );
      return '';
    }
  }
}
