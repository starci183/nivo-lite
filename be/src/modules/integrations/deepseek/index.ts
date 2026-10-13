export { DEEPSEEK_ERROR_KINDS, DeepseekError, DeepseekErrorCode } from "./errors/deepseek.error"
export { DEEPSEEK_MESSAGES } from "./messages/deepseek.messages"
export { DeepseekClient } from "./deepseek.client"
export { parseDeepseekConfig } from "./deepseek.config"
export type { DeepseekOptions } from "./deepseek.options"
export type {
    AgentInput,
    AuthorityChange,
    AuthorityInput,
    ChatApplication,
    ChatTurn,
    Classification,
    CommandOption,
    CommandProposalInput,
    CustomerChatOut,
    DeepseekScope,
    CustomerReference,
    DesignedModule,
    ExtractedOrder,
    LeadInput,
    OrderReference,
    ProposedCommand,
    ProposedResponsibility,
    TextRequest,
} from "./deepseek.contracts"
export { DEEPSEEK_TEXT_GENERATOR } from "./deepseek.decorators"
export { DeepseekModule } from "./deepseek.module"
export type { TextGenerator } from "./deepseek.port"
export { authorityBrief } from "./prompts.policy"
