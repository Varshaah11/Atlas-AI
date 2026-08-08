export interface UserPreferenceData {
  id?: string;
  userId: string;
  investmentStyle?: string | null;
  riskTolerance?: string | null;
  preferredSectors?: string[];
  preferredTickers?: string[];
  preferredMarket?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface UserMemoryData {
  id: string;
  userId: string;
  memory: string;
  category: string;
  importance: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IMemoryService {
  getUserPreferences(userId: string): Promise<UserPreferenceData | null>;
  updateUserPreferences(
    userId: string,
    data: Partial<Omit<UserPreferenceData, 'id' | 'userId'>>,
  ): Promise<UserPreferenceData>;
  getUserMemories(userId: string): Promise<UserMemoryData[]>;
  saveMemory(
    userId: string,
    memoryText: string,
    category?: string,
    importance?: number,
  ): Promise<UserMemoryData | null>;
  deleteMemory(memoryId: string): Promise<boolean>;
  buildMemoryPromptContext(userId: string): Promise<string>;
}

export const MEMORY_SERVICE_TOKEN = 'MEMORY_SERVICE_TOKEN';
