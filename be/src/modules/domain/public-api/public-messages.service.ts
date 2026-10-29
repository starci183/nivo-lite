import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { ApiKeysService } from "@modules/domain/api-keys"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { PublicApiQueue } from "@modules/queues/public-api"
import { PublicApiError, PublicApiErrorCode } from "./errors/public-api.error"
import type { AcceptMessageParams, AcceptedMessage, MessageRequestBody } from "./public-api.contracts"
import { dedupePrefix, messageDedupeSuffix } from "./public-api.policy"
import { PublicApiLedgerService } from "./public-api-ledger.service"
import { PublicConversationsService } from "./public-conversations.service"

@Injectable()
/** The messages the public API asks the chatbot to send, reached only through the shared primary EntityManager; the sending itself is a job decided by the owner's authority rule. */
export class PublicMessagesService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly queue: PublicApiQueue,
        private readonly keys: ApiKeysService,
        private readonly ledger: PublicApiLedgerService,
        private readonly conversations: PublicConversationsService,
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
            const conversation =
                conversationId === ""
                    ? await this.conversations.ofLead(who.workspaceId, leadId, tx)
                    : await this.conversations.find(who.workspaceId, conversationId, tx)
            if (conversation === undefined) throw new PublicApiError({ code: PublicApiErrorCode.ConversationNotFound })
            const body: MessageRequestBody = {
                conversationId: conversation.id,
                leadId: conversation.lead_id,
                text: params.text,
                requireApproval: params.requireApproval === true,
                source: `api:${who.name}`,
            }
            const request = await this.ledger.record(
                {
                    workspaceId: who.workspaceId,
                    keyId: who.keyId,
                    kind: "message",
                    prefix: dedupePrefix("message", who.keyId),
                    suffix: messageDedupeSuffix(params.idempotencyKey, conversation.id),
                    body,
                },
                tx,
            )
            if (request === undefined) throw new PublicApiError({ code: PublicApiErrorCode.NotWritten })
            if (request.inserted) {
                await this.queue.enqueueRequest({ requestId: request.id, workspaceId: who.workspaceId }, tx)
            }
            return { conversationId: conversation.id, status: "queued" }
        })
    }
}
