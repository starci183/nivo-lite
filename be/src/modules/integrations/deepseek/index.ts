export { DEEPSEEK_ERROR_KINDS } from "./errors/deepseek.error"
export { DEEPSEEK_MESSAGES } from "./messages/deepseek.messages"
export { DeepseekClient } from "./deepseek.client"
export { parseDeepseekConfig } from "./deepseek.config"
export type { DeepseekOptions } from "./deepseek.options"
export type {
    AgentInput,
    Classification,
    CommandProposalInput,
    DeepseekScope,
    ExtractedOrder,
    LeadInput,
    ProposedCommand,
    ProposedResponsibility,
    TextRequest,
} from "./deepseek.contracts"
export { DeepseekModule } from "./deepseek.module"
export type { TextGenerator } from "./deepseek.port"
export { authorityBrief } from "./prompts.policy"

export { InjectDeepseekClient } from "./deepseek.decorators"
