export { AI_TASKS_ERROR_KINDS } from "./errors/ai-tasks.error"
export { AI_TASKS_MESSAGES } from "./messages/ai-tasks.messages"
export { AiTasksService } from "./ai-tasks.service"
export { parseAiTasksConfig } from "./ai-tasks.config"
export type {
    AgentInput,
    Classification,
    CommandProposalInput,
    AiTaskScope,
    ExtractedOrder,
    LeadInput,
    ProposedCommand,
    ProposedResponsibility,
    TextRequest,
} from "./ai-tasks.contracts"
export { AiTasksModule } from "./ai-tasks.module"
export type { AiTaskTextGenerator } from "./ai-tasks.port"
export { authorityBrief } from "./prompts.policy"

export { AI_TASKS, InjectAiTasks } from "./ai-tasks.decorators"
export type { LeadTurnInput } from "./lead-turn-prompt.policy"
