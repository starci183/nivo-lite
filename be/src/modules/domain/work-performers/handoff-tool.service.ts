import { Injectable } from "@nestjs/common"
import { AgentConversationsService } from "@modules/domain/agent-conversations"
import { AgentMessagesService } from "@modules/domain/agent-messages"
import type { HandoffTool, ToolContext } from "@modules/domain/agent-tools"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"

/** The holder named on a conversation the engine handed to a person. */
const ENGINE_HOLDER = "NIVO engine"

@Injectable()
/** The handoff tool: from now on the AI stays quiet in the conversation until a person hands it back. */
export class HandoffToolService implements HandoffTool {
    constructor(
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly conversations: AgentConversationsService,
        private readonly messages: AgentMessagesService,
    ) {}

    /** Marks the conversation held by a person and posts the system line the workbench shows. */
    async handoff(ctx: ToolContext): Promise<void> {
        await this.conversations.handToPerson(ctx.workspaceId, ctx.conversationId, ENGINE_HOLDER)
        await this.messages.storeLine(
            ctx.workspaceId,
            ctx.conversationId,
            this.catalog.get("performers.needsHuman", {}, "vi"),
        )
    }
}
