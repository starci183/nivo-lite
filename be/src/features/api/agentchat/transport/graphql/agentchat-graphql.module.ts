import { Module } from "@nestjs/common"
import { AgentchatApiModule } from "../../agentchat.module"
import { GetAgentChatPageResolver } from "./agent-chat-page.resolver"
import { ListAgentChatConversationsResolver } from "./agent-chat-conversations.resolver"
import { ListAgentChatMessagesResolver } from "./agent-chat-messages.resolver"
import { ConfigurableModuleClass } from "./agentchat-graphql.module-definition"
import { StartAgentChatConversationResolver } from "./start-agent-chat-conversation.resolver"
import { SendAgentChatMessageResolver } from "./send-agent-chat-message.resolver"
import { TakeOverAgentChatConversationResolver } from "./take-over-agent-chat-conversation.resolver"
import { GetAgentChatTurnStatusResolver } from "./agent-chat-turn-status.resolver"

@Module({
    imports: [AgentchatApiModule.register({})],
    providers: [
        GetAgentChatPageResolver,
        ListAgentChatConversationsResolver,
        ListAgentChatMessagesResolver,
        StartAgentChatConversationResolver,
        SendAgentChatMessageResolver,
        TakeOverAgentChatConversationResolver,
        GetAgentChatTurnStatusResolver,
    ],
})
/** GraphQL transport of the agent chat feature. */
export class AgentChatGraphqlModule extends ConfigurableModuleClass {}
