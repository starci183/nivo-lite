import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { ApiKeysService } from "@modules/domain/api-keys"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { PublicApiQueue } from "@modules/queues/public-api"
import { PublicApiError, PublicApiErrorCode } from "./errors/public-api.error"
import type { AcceptMessageParams, AcceptedMessage, MessageRequestBody, RecordedRequest } from "./public-api.contracts"
import { dedupePrefix, messageDedupeSuffix } from "./public-api.policy"
import type { ConversationsRow } from "./persistence/public-api.rows"
import { INSERT_REQUEST, SELECT_CONVERSATION, SELECT_CONVERSATION_OF_LEAD } from "./persistence/public-api.sql"

type ConversationRow = Pick<ConversationsRow, "id" | "lead_id">

@Injectable()
/** The messages the public API asks the chatbot to send, reached only through the shared primary EntityManager; the sending itself is a job decided by the owner's authority rule. */
export class PublicMessagesService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly queue: PublicApiQueue,
        private readonly keys: ApiKeysService,
    ) {}

    /**
     * Queues a message to a customer conversation of the key's workspace; a conversation of another workspace is not found. The same
     * idempotency key for the same conversation is one message.
     */
    async acceptMessage(params: AcceptMessageParams): Promise<AcceptedMessage> {
        const who = await this.keys.authenticate("messages:write", params.authorization)
        const conversationId = params.conversationId ?? ""
        const leadId = params.leadId ?? ""
        if (conversationId === "" && leadId === "") {
            throw new PublicApiError({ code: PublicApiErrorCode.TargetMissing })
        }
        return this.entityManager.transaction(async (tx) => {
            const [conversation] =
                conversationId === ""
                    ? await tx.query<Array<ConversationRow>>(SELECT_CONVERSATION_OF_LEAD, [who.workspaceId, leadId])
                    : await tx.query<Array<ConversationRow>>(SELECT_CONVERSATION, [who.workspaceId, conversationId])
            if (conversation === undefined) throw new PublicApiError({ code: PublicApiErrorCode.ConversationNotFound })
            const body: MessageRequestBody = {
                conversationId: conversation.id,
                leadId: conversation.lead_id,
                text: params.text,
                requireApproval: params.requireApproval === true,
                source: `api:${who.name}`,
            }
            const [request] = await tx.query<Array<RecordedRequest>>(INSERT_REQUEST, [
                who.workspaceId,
                who.keyId,
                "message",
                dedupePrefix("message", who.keyId),
                messageDedupeSuffix(params.idempotencyKey, conversation.id),
                JSON.stringify(body),
            ])
            if (request === undefined) throw new PublicApiError({ code: PublicApiErrorCode.NotWritten })
            if (request.inserted) {
                await this.queue.enqueueRequest({ requestId: request.id, workspaceId: who.workspaceId }, tx)
            }
            return { conversationId: conversation.id, status: "queued" }
        })
    }
}
