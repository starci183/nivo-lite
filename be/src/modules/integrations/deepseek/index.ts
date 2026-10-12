export { DEEPSEEK_ERROR_KINDS, DeepseekError, DeepseekErrorCode } from "./errors/deepseek.error"
export { DEEPSEEK_MESSAGES } from "./messages/deepseek.messages"
export { DeepseekClient } from "./deepseek.client"
export { parseDeepseekConfig } from "./deepseek.config"
export type {
    AgentInput,
    AuthorityChange,
    AuthorityInput,
    ChatApplication,
    ChatTurn,
    Classification,
    CustomerChatOut,
    DeepseekScope,
    DesignedModule,
    ExtractedOrder,
    LeadInput,
    ProposedResponsibility,
    TextRequest,
} from "./deepseek.contracts"
export { DEEPSEEK_TEXT_GENERATOR } from "./deepseek.decorators"
export { DeepseekModule } from "./deepseek.module"
export type { TextGenerator } from "./deepseek.port"
export { authorityBrief } from "./prompts.policy"
