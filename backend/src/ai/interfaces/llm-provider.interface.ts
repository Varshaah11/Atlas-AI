import { PreparedLLMContext } from '../context/interfaces/context-builder.interface';

export interface LLMExecutionResult {
  text: string;
  executionTimeMs: number;
}

export interface ILLMProvider {
  generateResponse(context: PreparedLLMContext): Promise<LLMExecutionResult>;
  isHealthy(): Promise<boolean>;
}

export const LLM_PROVIDER_TOKEN = 'LLM_PROVIDER_TOKEN';
