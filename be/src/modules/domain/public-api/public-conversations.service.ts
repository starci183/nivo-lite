import { Injectable } from "@nestjs/common"
import { ChatConversationsService } from "@modules/domain/chat-records"

/** A customer conversation of a workspace as the public API reads it. */
export interface PublicConversationRef {
    /** The conversation id. */
    readonly id: string
    /** The customer of the conversation, or null. */
    readonly lead_id: string | null
}

@Injectable()
/** The customer conversations the public API reads, as the chat records hold them. */
export class PublicConversationsService {
    constructor(private readonly chats: ChatConversationsService) {}

    /** A customer conversation of the workspace by id; another workspace's is not found. */
    async find(workspaceId: string, conversationId: string): Promise<PublicConversationRef | undefined> {
        const chat = await this.chats.humanOf(workspaceId, conversationId)
        return chat === null ? undefined : { id: chat.id, lead_id: chat.leadId }
    }
}
