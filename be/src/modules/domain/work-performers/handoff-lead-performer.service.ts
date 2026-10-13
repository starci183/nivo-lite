import { Injectable } from "@nestjs/common"
import { AgentConversationsService } from "@modules/domain/agent-conversations"
import { EvidenceService } from "@modules/domain/decisions"
import type { Performed, Prepared, Proposal, WorkContext, WorkItem, WorkPerformer } from "@modules/domain/decisions"
import { AgentsService } from "@modules/domain/agents"
import { InboundEventsService } from "@modules/domain/inbound-events"
import { LeadRecordsService, contactParts } from "@modules/domain/leads"
import { ResponsibilityJournalService } from "@modules/domain/responsibilities"
import { PerformerKitService } from "./performer-kit.service"
import { leadHref, textOf } from "./performer.policy"

@Injectable()
/** `handoff_lead`: the chatbot hands a customer it captured to Sales; a customer already known is matched, never duplicated. */
export class HandoffLeadPerformerService implements WorkPerformer {
    constructor(
        private readonly kit: PerformerKitService,
        private readonly leads: LeadRecordsService,
        private readonly agents: AgentsService,
        private readonly conversations: AgentConversationsService,
        private readonly inbound: InboundEventsService,
        private readonly responsibilities: ResponsibilityJournalService,
        private readonly evidence: EvidenceService,
    ) {}

    /** The summary the owner reads for the handoff. */
    prepare(ctx: WorkContext, item: WorkItem): Promise<Prepared> {
        const fields = item.proposal.fields
        const summary = this.kit.text(ctx, "handoffSummary", {
            name: textOf(fields.contact_name),
            need: textOf(fields.need),
        })
        return Promise.resolve({ proposal: { ...item.proposal, summary, fields } })
    }

    /** Finds or creates the customer, ties the input and the conversation to them and makes sure somebody owes them a follow-up. */
    async perform(ctx: WorkContext, item: WorkItem, proposal: Proposal): Promise<Performed> {
        const fields = proposal.fields
        const contact = contactParts(textOf(fields.contact))
        const phone = contactParts(textOf(fields.phone)).phone ?? contact.phone
        const email = contactParts(textOf(fields.email)).email ?? contact.email
        const channel = textOf(fields.channel_label) === "" ? "—" : textOf(fields.channel_label)
        const known = await this.leads.match({
            workspaceId: ctx.workspaceId,
            phone,
            email,
            name: textOf(fields.contact_name),
            channel,
            origin: item.origin,
        })
        const lead =
            known ??
            (await this.leads.capture({
                workspaceId: ctx.workspaceId,
                contactName: textOf(fields.contact_name),
                company: textOf(fields.company) === "" ? this.kit.text(ctx, "notShared") : textOf(fields.company),
                channel,
                need: textOf(fields.need),
                phone,
                email,
                origin: item.origin,
            }))
        if (known === null) await this.logCapture(ctx, item, lead.id, channel, textOf(fields.transcript))
        else if ((phone !== null && known.phone === null) || (email !== null && known.email === null)) {
            await this.leads.fillContact({ workspaceId: ctx.workspaceId, leadId: lead.id, phone, email })
        }
        if (item.inbound_event_id !== null)
            await this.inbound.mark(ctx.workspaceId, item.inbound_event_id, null, lead.id)
        if (textOf(fields.conversation_id) !== "") {
            await this.conversations.attachLead(ctx.workspaceId, textOf(fields.conversation_id), lead.id)
        }
        await this.responsibilities.ensureFor(ctx, lead.id)
        const key = known === null ? "handoffDone" : "leadMatched"
        return {
            summary: this.kit.text(ctx, key, { name: lead.contact_name }),
            evidence: "captured",
            href: leadHref(lead.id),
            lead_id: lead.id,
        }
    }

    private async logCapture(
        ctx: WorkContext,
        item: WorkItem,
        leadId: string,
        channel: string,
        transcript: string,
    ): Promise<void> {
        const bot = await this.agents.agentOfDepartment(ctx.workspaceId, "chatbot", null)
        await this.evidence.log(ctx, {
            lead_id: leadId,
            work_item_id: item.id,
            kind: "lead.captured",
            actor: bot?.name ?? (await this.kit.department(ctx, "chatbot")),
            summary: this.kit.text(ctx, "capturedFrom", { channel }),
            evidence: transcript === "" ? null : transcript,
        })
    }
}
