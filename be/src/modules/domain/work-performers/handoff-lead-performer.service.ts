import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AgentConversationsService } from "@modules/domain/agent-conversations"
import { ContractsService } from "@modules/domain/contracts"
import { EvidenceService } from "@modules/domain/decisions"
import type { Performed, Prepared, Proposal, WorkContext, WorkItem, WorkPerformer } from "@modules/domain/decisions"
import { AgentsService } from "@modules/domain/agents"
import { InboundEventsService } from "@modules/domain/inbound-events"
import { LeadRecordsService, contactParts } from "@modules/domain/leads"
import type { LeadRecordRow } from "@modules/domain/leads"
import { PublicLeadCompletionService } from "@modules/domain/public-api"
import { ResponsibilityJournalService } from "@modules/domain/responsibilities"
import { LeadCapturedEvent, whenPresent } from "@modules/events/api"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectEventBus } from "@modules/platform/event-bus"
import type { EventBus } from "@modules/platform/event-bus"
import { LeadHandoverService } from "./lead-handover.service"
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
        private readonly apiCompletion: PublicLeadCompletionService,
        private readonly contracts: ContractsService,
        private readonly handover: LeadHandoverService,
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectEventBus() private readonly bus: EventBus,
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
        const known =
            item.lead_id === null
                ? await this.leads.match({
                      workspaceId: ctx.workspaceId,
                      phone,
                      email,
                      name: textOf(fields.contact_name),
                      channel,
                  })
                : await this.leads.require(ctx.workspaceId, item.lead_id)
        const lead =
            known ??
            (await this.captureLead(ctx, item, channel, textOf(fields.transcript), {
                workspaceId: ctx.workspaceId,
                contactName: textOf(fields.contact_name),
                company: textOf(fields.company) === "" ? this.kit.text(ctx, "notShared") : textOf(fields.company),
                channel,
                need: textOf(fields.need),
                phone,
                email,
            }))
        if (known !== null && ((phone !== null && known.phone === null) || (email !== null && known.email === null))) {
            await this.leads.fillContact({ workspaceId: ctx.workspaceId, leadId: lead.id, phone, email })
        }
        if (item.inbound_event_id !== null)
            await this.inbound.mark(ctx.workspaceId, item.inbound_event_id, null, lead.id)
        if (textOf(fields.conversation_id) !== "") {
            await this.conversations.attachLead(ctx.workspaceId, textOf(fields.conversation_id), lead.id)
            await this.handover.toSales(ctx, textOf(fields.conversation_id), lead.contact_name)
        }
        // The lead now carries its contact, so a contract of this customer finds it for the renewal.
        await this.contracts.linkCustomers(ctx.workspaceId)
        await this.responsibilities.ensureFor(ctx, lead.id)
        await this.apiCompletion.complete(ctx, item, lead.id, proposal, known !== null)
        const key = known === null ? "handoffDone" : "leadMatched"
        return {
            summary: this.kit.text(ctx, key, { name: lead.contact_name }),
            evidence: "captured",
            href: leadHref(lead.id),
            lead_id: lead.id,
        }
    }

    /** Captures the customer, leaves the capture evidence and publishes `lead_captured`, all in one transaction. */
    private async captureLead(
        ctx: WorkContext,
        item: WorkItem,
        channel: string,
        transcript: string,
        input: Parameters<LeadRecordsService["capture"]>[0],
    ): Promise<LeadRecordRow> {
        const bot = await this.agents.agentOfDepartment(ctx.workspaceId, "chatbot", null)
        const actor = bot?.name ?? (await this.kit.department(ctx, "chatbot"))
        return this.entityManager.transaction(async (tx) => {
            const lead = await this.leads.capture(input, tx)
            await this.evidence.log(
                ctx,
                {
                    lead_id: lead.id,
                    work_item_id: item.id,
                    kind: "lead.captured",
                    actor,
                    summary: this.kit.text(ctx, "capturedFrom", { channel }),
                    evidence: transcript === "" ? null : transcript,
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
                    ...whenPresent("email", lead.email),
                }),
                tx,
                `lead_captured:${lead.id}`,
            )
            return lead
        })
    }
}
