import { Injectable } from "@nestjs/common"
import { ChatActivityService, chatActivityTarget } from "@modules/domain/chat-activity"
import type { SystemMessage } from "./messages.contracts"
import { MessageEntity } from "./persistence/entities"

@Injectable()
/** The team chat: the only writer of public.messages. */
export class MessagesService {
    constructor(private readonly activity: ChatActivityService) {}

    /** Posts one NIVO line in the team chat, inside the transaction of the caller. */
    async postSystem(message: SystemMessage): Promise<void> {
        await message.manager.insert(MessageEntity, {
            workspaceId: message.workspaceId,
            leadId: message.leadId,
            authorKind: "system",
            authorName: "NIVO",
            body: message.body,
        })
        await this.activity.message(
            message.workspaceId,
            chatActivityTarget({ room: null, conversationId: null }),
            null,
            message.manager,
        )
    }
}
