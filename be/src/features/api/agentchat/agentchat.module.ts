import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./agentchat.module-definition"
import { GetAgentChatPageHandler } from "./application/agent-chat-page.handler"
import { ListAgentChatConversationsHandler } from "./application/agent-chat-conversations.handler"
import { ListAgentChatMessagesHandler } from "./application/agent-chat-messages.handler"
import { StartAgentChatConversationHandler } from "./application/start-agent-chat-conversation.handler"
import { RequestAgentChatFileUploadHandler } from "./application/request-agent-chat-file-upload.handler"
import { SendAgentChatMessageHandler } from "./application/send-agent-chat-message.handler"
import { TakeOverAgentChatConversationHandler } from "./application/take-over-agent-chat-conversation.handler"
import { GetAgentChatTurnStatusHandler } from "./application/agent-chat-turn-status.handler"

@Module({
    providers: [
        GetAgentChatPageHandler,
        ListAgentChatConversationsHandler,
        ListAgentChatMessagesHandler,
        StartAgentChatConversationHandler,
        RequestAgentChatFileUploadHandler,
        SendAgentChatMessageHandler,
        TakeOverAgentChatConversationHandler,
        GetAgentChatTurnStatusHandler,
    ],
})
/** Application handlers of the agent chat feature. */
export class AgentchatApiModule extends ConfigurableModuleClass {}
