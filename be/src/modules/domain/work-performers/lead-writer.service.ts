import { Injectable } from "@nestjs/common"
import { AgentConversationsService } from "@modules/domain/agent-conversations"
import type { LeadDraft, LeadWriteResult, LeadWriter, ToolContext } from "@modules/domain/agent-tools"
import { CommandBusService } from "@modules/domain/decisions"
import type { WorkContext } from "@modules/domain/decisions"
import { InboundEventsService } from "@modules/domain/inbound-events"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"

/** Who the evidence lines of a tool call name as the actor. */
const ACTOR = "NIVO engine"

@Injectable()
/**
 * Writes the lead an agent captured in a chat: the input is recorded, then the `handoff_lead` command goes through the gate. A
 * conversation already tied to a lead is the owner's record and is not rewritten from a chat tool.
 */
export class LeadWriterService implements LeadWriter {
    constructor(
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly conversations: AgentConversationsService,
        private readonly inbound: InboundEventsService,
        private readonly bus: CommandBusService,
    ) {}

    /** Hands the captured customer to Sales through the gate; answers the lead and how the gate answered. */
    async createOrUpdate(ctx: ToolContext, lead: LeadDraft): Promise<LeadWriteResult> {
        const turn = await this.conversations.turnOf(ctx.conversationId)
        if (turn.kind !== "ok") return { leadId: null, status: "unavailable" }
        if (turn.value.leadId !== null) return { leadId: turn.value.leadId, status: "exists" }
        const work: WorkContext = { workspaceId: ctx.workspaceId, actor: ACTOR, locale: "vi" }
        const recorded = await this.inbound.recordInput({
            workspaceId: ctx.workspaceId,
            channel: turn.value.channel,
            kind: "lead",
            senderName: lead.contactName,
            senderContact: lead.contact,
            body: lead.need,
            externalRef: ctx.conversationId,
            eventId: `engine:${ctx.jobId}:lead`,
        })
        if (recorded.duplicate) return { leadId: null, status: "duplicate" }
        const item = await this.bus.sendCommandItem(work, {
            from: "inbound",
            to: "chatbot",
            command: "handoff_lead",
            reason: "the agent captured a lead",
            inboundEventId: recorded.inboundEventId,
            dedupeKey: `handoff_lead:conversation:${ctx.conversationId}`,
            payload: {
                subject_type: "conversation",
                subject_id: ctx.conversationId,
                contact_name: lead.contactName,
                company: lead.company ?? "",
                need: lead.need,
                contact: lead.contact,
                channel_label: this.catalog.get(`performers.channel.${turn.value.channel}`, {}, "vi"),
                conversation_id: ctx.conversationId,
            },
        })
        await this.conversations.rename(ctx.conversationId, lead.contactName)
        if (item.lead_id !== null)
            await this.conversations.attachLead(ctx.workspaceId, ctx.conversationId, item.lead_id)
        return { leadId: item.lead_id, status: item.status }
    }
}
