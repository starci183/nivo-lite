import { ConversationHandoverService } from "@modules/domain/agent-conversations"
import { AgentDirectoryService } from "@modules/domain/agents"
import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"

/** Injects the conversation handover, which the capability that owns the conversations may leave unbound. Parameter type: ConversationHandoverService. */
export const InjectConversationHandover = (): TypedParameterDecorator<ConversationHandoverService> =>
    injector<ConversationHandoverService>(ConversationHandoverService)

/** Injects the directory of the agents of a workspace, which the capability that owns the agents may leave unbound. Parameter type: AgentDirectoryService. */
export const InjectTagAgentDirectory = (): TypedParameterDecorator<AgentDirectoryService> =>
    injector<AgentDirectoryService>(AgentDirectoryService)
