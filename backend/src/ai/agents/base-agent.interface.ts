import { ConversationTask } from '../orchestrator/conversation-task';
import { ExecutionContext } from '../orchestrator/execution-context';
import { AgentCapability, AgentResult } from './agent.types';

export interface BaseAgent {
  readonly name: string;
  readonly capabilities: AgentCapability[];

  canHandle(task: ConversationTask): boolean;
  execute(context: ExecutionContext): Promise<AgentResult>;
}
