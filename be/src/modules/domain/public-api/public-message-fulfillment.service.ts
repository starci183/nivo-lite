import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AgentBindingsService } from "@modules/domain/agent-connections"
import { ApiKeyOwnerService } from "@modules/domain/api-keys"
import { EventsService } from "@modules/domain/events"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { PublicApiError, PublicApiErrorCode } from "./errors/public-api.error"
import type { MessageRequestBody, PendingMessageDelivery } from "./public-api.contracts"
import { PublicApiLogEvent } from "./public-api.log-events"
import { isStaleMessageAdmission } from "./public-api.policy"
import { PublicConversationsService } from "./public-conversations.service"
import { PublicMessageHoldsService } from "./public-message-holds.service"

/** What a send may change from the public door's default: the key its send is made once under, and whether the message's evidence is recorded. */
export interface FulfillOptions {
    /** The send's key; absent takes `api.message:<request>`. */
    readonly dedupeKey?: string
    /** Whether the evidence of the message is recorded; absent records it. */
    readonly recordEvidence?: boolean
}

@Injectable()
/**
 * Turns an admitted API message into a send owed to the person of its ROUTE: the sender is the API key's agent while it exists in the
 * workspace, else the front door that answers the route's entrance (else the workspace's installed front door, else the typed refusal
 * of the key's owner lookup: customer-messages rule 10). No chat line is stored. Inside the caller's domain transaction it records the
 * evidence; the send to the channel is the caller's, after commit, claimed once per request in the delivery ledger.
 */
export class PublicMessageFulfillmentService {
    constructor(
        private readonly owners: ApiKeyOwnerService,
        private readonly bindings: AgentBindingsService,
        private readonly events: EventsService,
        private readonly conversations: PublicConversationsService,
        private readonly holds: PublicMessageHoldsService,
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /**
     * Answers the send still to make (the delivery ledger's claim keeps a repeat from sending twice). A message that asks for an
     * approval, or that was admitted longer ago than its auto-send window (`admittedAt` null: a pre-ledger delivery), is HELD: no approval
     * road takes a message outside a run, so nothing is sent, the hold is recorded, and the founder is told once on /chat, with
     * the exact text, as an unhandled case a person answers from the workbench.
     */
    async fulfill(
        workspaceId: string,
        requestId: string,
        body: MessageRequestBody,
        admittedAt: Date | null,
        keyId: string | null,
        manager: EntityManager,
        options: FulfillOptions = {},
    ): Promise<PendingMessageDelivery | null> {
        const { dedupeKey = `api.message:${requestId}`, recordEvidence = true } = options
        const conversation = await this.conversations.find(workspaceId, body.conversationId)
        if (conversation === undefined) throw new PublicApiError({ code: PublicApiErrorCode.ConversationNotFound })
        const agentId = await this.senderOf(workspaceId, keyId, conversation.accountId)
        const isStale = isStaleMessageAdmission(admittedAt, this.clock.now())
        if (body.requireApproval || isStale) {
            if (isStale)
                this.logger.info(PublicApiLogEvent.StaleMessageHeld, {
                    workspaceId,
                    requestId,
                    admittedAt: admittedAt?.toISOString() ?? null,
                })
            await this.events.record(
                {
                    workspaceId,
                    kind: "api.message.held",
                    actor: body.source,
                    summary: "Message held: it waits for an approval no road takes",
                    evidence: body.text,
                },
                manager,
            )
            await this.holds.report({
                workspaceId,
                agentId,
                conversationId: conversation.id,
                requestId,
                text: body.text,
                reason: body.requireApproval ? "approval_asked" : "stale",
            })
            return null
        }
        if (recordEvidence)
            await this.events.record(
                {
                    workspaceId,
                    kind: "api.message",
                    actor: body.source,
                    summary: "Message accepted through the API",
                    evidence: body.text,
                },
                manager,
            )
        return {
            workspaceId,
            sendKey: dedupeKey,
            routeId: conversation.id,
            contactId: conversation.contactId,
            agentId,
            channel: conversation.channel,
            accountId: conversation.accountId,
            text: body.text,
        }
    }

    /** The agent that tells it: the key's own agent while it exists, else the route's front door, else the key owner's own answer (or refusal). */
    private async senderOf(workspaceId: string, keyId: string | null, accountId: string | null): Promise<string> {
        const scoped = keyId === null ? null : await this.owners.scopedAgentOf(workspaceId, keyId)
        if (scoped !== null) return scoped
        const front = accountId === null ? null : await this.bindings.owningAgentOf(workspaceId, accountId)
        if (front !== null) return front
        if (keyId === null) throw new PublicApiError({ code: PublicApiErrorCode.ConversationNotFound })
        const installed = await this.owners.agentOfKey(workspaceId, keyId)
        if (installed === null) throw new PublicApiError({ code: PublicApiErrorCode.ConversationNotFound })
        return installed
    }
}
