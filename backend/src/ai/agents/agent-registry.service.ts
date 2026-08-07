import { Injectable } from '@nestjs/common';
import { ConversationTask } from '../orchestrator/conversation-task';
import { AgentCapability } from './agent.types';
import { BaseAgent } from './base-agent.interface';
import { AppLogger } from '@/common/logger/logger.service';

@Injectable()
export class AgentRegistryService {
  private readonly agents = new Map<string, BaseAgent>();

  constructor(private readonly logger: AppLogger) {}

  registerAgent(agent: BaseAgent): void {
    if (this.agents.has(agent.name)) {
      this.logger.warn(
        `Agent ${agent.name} is already registered. Overwriting registration.`,
        'AgentRegistryService',
      );
    }
    this.agents.set(agent.name, agent);
    this.logger.log(
      `Registered Agent "${agent.name}" with capabilities: [${agent.capabilities.join(', ')}]`,
      'AgentRegistryService',
    );
  }

  getAgentByName(name: string): BaseAgent | null {
    return this.agents.get(name) || null;
  }

  getAgentsByCapability(capability: AgentCapability): BaseAgent[] {
    const matched: BaseAgent[] = [];
    for (const agent of this.agents.values()) {
      if (agent.capabilities.includes(capability)) {
        matched.push(agent);
      }
    }
    return matched;
  }

  findAgentForTask(task: ConversationTask): BaseAgent | null {
    for (const agent of this.agents.values()) {
      if (agent.canHandle(task)) {
        return agent;
      }
    }
    return null;
  }

  getAllRegisteredAgents(): BaseAgent[] {
    return Array.from(this.agents.values());
  }
}
