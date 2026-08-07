export enum AgentCapability {
  INTENT_CLASSIFICATION = 'INTENT_CLASSIFICATION',
  ENTITY_EXTRACTION = 'ENTITY_EXTRACTION',
  CLARIFICATION = 'CLARIFICATION',
  COMPANY_RESEARCH = 'COMPANY_RESEARCH',
  MARKET_DATA = 'MARKET_DATA',
  DOCUMENT_ANALYSIS = 'DOCUMENT_ANALYSIS',
  DECISION_MAKING = 'DECISION_MAKING',
}

export interface AgentResult {
  agentName: string;
  success: boolean;
  output: string;
  executionTimeMs?: number;
  metadata?: Record<string, unknown>;
}
