import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { DurableWorkService, EvidenceService } from "@modules/domain/decisions"
import type { WorkContext } from "@modules/domain/decisions"
import { PublicApiError, PublicApiErrorCode } from "./errors/public-api.error"
import type { MessageRequestBody } from "./public-api.contracts"
import type { ConversationsRow } from "./persistence/public-api.rows"
import { SELECT_CONVERSATION } from "./persistence/public-api.sql"

@Injectable()
/** Turns an admitted API message into durable chatbot work, using the caller's domain transaction. */
export class PublicMessageFulfillmentService {
    constructor(
        private readonly work: DurableWorkService,
        private readonly evidence: EvidenceService,
    ) {}

    /** Keeps the exact draft and approval requirement behind the existing authority and outbound-access gate. */
    async fulfill(
        workspaceId: string,
        requestId: string,
        body: MessageRequestBody,
        manager: EntityManager,
        dedupeKey: string = `api.message:${requestId}`,
        recordEvidence: boolean = true,
    ): Promise<string | null> {
        const [conversation] = await manager.query<Array<Pick<ConversationsRow, "id" | "lead_id">>>(
            SELECT_CONVERSATION,
            [workspaceId, body.conversationId],
        )
        if (conversation === undefined) throw new PublicApiError({ code: PublicApiErrorCode.ConversationNotFound })
        const ctx: WorkContext = { workspaceId, actor: body.source, locale: "en" }
        const item = await this.work.enqueueWork(
            ctx,
            {
                action: "reply_customer",
                subject_type: "conversation",
                subject_id: conversation.id,
                lead_id: conversation.lead_id,
                dedupeKey,
                seed: {
                    summary: "Public API message",
                    draft: body.text,
                    fields: { conversation_id: conversation.id },
                    confidence: 1,
                    outcome: "clear",
                },
                preset: true,
                noChain: true,
                forceAsk: body.requireApproval ? "over_authority" : undefined,
            },
            manager,
        )
        if (recordEvidence)
            await this.evidence.log(
                ctx,
                {
                    lead_id: conversation.lead_id,
                    work_item_id: item.id,
                    kind: "api.message",
                    actor: body.source,
                    summary: "Message accepted through the API",
                    evidence: body.text,
                },
                manager,
            )
        return conversation.lead_id
    }
}
