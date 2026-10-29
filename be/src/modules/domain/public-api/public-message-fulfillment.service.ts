import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { DurableWorkService, EvidenceService } from "@modules/domain/decisions"
import type { WorkContext } from "@modules/domain/decisions"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { PublicApiError, PublicApiErrorCode } from "./errors/public-api.error"
import type { MessageRequestBody } from "./public-api.contracts"
import { PublicApiLogEvent } from "./public-api.log-events"
import { isStaleMessageAdmission } from "./public-api.policy"
import { PublicConversationsService } from "./public-conversations.service"

@Injectable()
/** Turns an admitted API message into durable chatbot work, using the caller's domain transaction. */
export class PublicMessageFulfillmentService {
    constructor(
        private readonly work: DurableWorkService,
        private readonly evidence: EvidenceService,
        private readonly conversations: PublicConversationsService,
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /**
     * Keeps the exact draft and approval requirement behind the existing authority and outbound-access gate. A message admitted
     * longer ago than its auto-send window (`admittedAt` null: a pre-ledger delivery) always waits for approval.
     */
    async fulfill(
        workspaceId: string,
        requestId: string,
        body: MessageRequestBody,
        admittedAt: Date | null,
        manager: EntityManager,
        dedupeKey: string = `api.message:${requestId}`,
        recordEvidence: boolean = true,
    ): Promise<string | null> {
        const conversation = await this.conversations.find(workspaceId, body.conversationId, manager)
        if (conversation === undefined) throw new PublicApiError({ code: PublicApiErrorCode.ConversationNotFound })
        const ctx: WorkContext = { workspaceId, actor: body.source, locale: "en" }
        const isStale = isStaleMessageAdmission(admittedAt, this.clock.now())
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
                forceAsk: body.requireApproval || isStale ? "over_authority" : undefined,
            },
            manager,
        )
        if (isStale)
            this.logger.info(PublicApiLogEvent.StaleMessageHeld, {
                workspaceId,
                requestId,
                workItemId: item.id,
                admittedAt: admittedAt?.toISOString() ?? null,
            })
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
