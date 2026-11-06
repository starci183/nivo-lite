import { Injectable, Optional } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import type { EffectPayload, SubjectRef } from "@nivo-lite/agent-sdk/node"
import type { EntityManager } from "typeorm"
import { ChatConversationsService } from "@modules/domain/chat-records"
import type { ChatTurnConversation } from "@modules/domain/chat-records"
import type { WorkContext } from "@modules/domain/decisions"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import type { NodeTurn } from "@modules/domain/graph-nodes"
import { LeadRecordsService, contactParts } from "@modules/domain/leads"
import type { LeadRecordRow } from "@modules/domain/leads"
import { ResponsibilityJournalService } from "@modules/domain/responsibilities"
import { LeadCapturedEvent, whenPresent } from "@modules/events/api"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectEventBus } from "@modules/platform/event-bus"
import type { EventBus } from "@modules/platform/event-bus"
import { WorkPerformersError, WorkPerformersErrorCode } from "./errors/work-performers.error"
import { ensurePayload } from "./lead-ensure.schema"
import type { EnsurePayload } from "./lead-ensure.schema"
import { PerformerKitService } from "./performer-kit.service"

/** The name under which a graph node writes in the Office. */
const ACTOR = "NIVO"

@Injectable()
/**
 * The executor of the `lead.ensure` effect: the customer of a conversation is the lead it is already tied to, else a lead the chat's own
 * facts match (the same phone, or a name the customer gave on the same channel), else a new one; the conversation is tied to it and
 * somebody owes it a follow-up. A display name the conversation carries, and the guest placeholder every anonymous sender shares, names a
 * new lead but never matches one. It lives here and not with the leads, because tying the conversation needs the chat records capability.
 * It is a pivot: a lead other records point at is not taken back.
 */
export class LeadEnsureExecutorService implements OnModuleInit {
    constructor(
        private readonly kit: PerformerKitService,
        private readonly conversations: ChatConversationsService,
        private readonly leads: LeadRecordsService,
        private readonly responsibilities: ResponsibilityJournalService,
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectEventBus() private readonly bus: EventBus,
        @Optional() private readonly registry?: GraphNodeRegistryService,
    ) {}

    /** Registers the executor when the app hosts graph nodes; otherwise there is nothing to serve. */
    onModuleInit(): void {
        this.registry?.addExecutor({ effect: "lead.ensure", execute: (turn, payload) => this.ensure(turn, payload) })
    }

    private async ensure(turn: NodeTurn, payload: EffectPayload): Promise<SubjectRef> {
        const given = ensurePayload.parse(payload)
        const found = await this.conversations.turnOf(turn.workspaceId, given.conversationId)
        if (found.kind !== "ok") {
            throw new WorkPerformersError({ code: WorkPerformersErrorCode.ConversationUnavailable })
        }
        const subject = (leadId: string): SubjectRef => ({ kind: "sales-lead", id: leadId })
        if (found.value.leadId !== null) return subject(found.value.leadId)
        const ctx: WorkContext = { workspaceId: turn.workspaceId, actor: ACTOR, locale: turn.locale }
        const lead = await this.leadOf(ctx, given, found.value)
        await this.conversations.attachLead(turn.workspaceId, given.conversationId, lead.id)
        await this.responsibilities.ensureFor(ctx, lead.id)
        return subject(lead.id)
    }

    /**
     * The lead the chat's facts match, else a new one captured with `lead_captured` published in the same transaction.
     */
    private async leadOf(
        ctx: WorkContext,
        given: EnsurePayload,
        conversation: ChatTurnConversation,
    ): Promise<LeadRecordRow> {
        const phone = contactParts(given.phone ?? null).phone
        const name = given.name ?? conversation.visitorName ?? this.kit.text(ctx, "notShared")
        const channel = this.kit.text(ctx, `channel.${given.channel}`)
        const matchName = given.name ?? null
        const known = await this.leads.match({
            workspaceId: ctx.workspaceId,
            phone,
            email: null,
            name: matchName,
            channel,
        })
        if (known !== null) {
            if (phone !== null && known.phone === null) {
                await this.leads.fillContact({ workspaceId: ctx.workspaceId, leadId: known.id, phone, email: null })
            }
            return known
        }
        return this.entityManager.transaction(async (tx) => {
            const lead = await this.leads.capture(
                {
                    workspaceId: ctx.workspaceId,
                    contactName: name,
                    company: this.kit.text(ctx, "notShared"),
                    channel,
                    need: "—",
                    phone,
                    email: null,
                },
                tx,
            )
            await this.bus.publish(
                LeadCapturedEvent.create({
                    workspaceId: ctx.workspaceId,
                    leadId: lead.id,
                    contactName: lead.contact_name,
                    company: lead.company,
                    channel: lead.channel,
                    need: lead.need,
                    ...whenPresent("phone", lead.phone),
                }),
                tx,
                `lead_captured:${lead.id}`,
            )
            return lead
        })
    }
}
