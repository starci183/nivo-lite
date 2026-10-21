import { Injectable } from "@nestjs/common"
import { AutomationsService } from "@modules/domain/automations"
import { CommandBusService, WorkEngineService } from "@modules/domain/decisions"
import type { WorkContext, WorkItem } from "@modules/domain/decisions"
import { InboundEventsService } from "@modules/domain/inbound-events"
import { LeadRecordsService, contactParts } from "@modules/domain/leads"
import { ResponsibilityJournalService } from "@modules/domain/responsibilities"
import { WorkItemsService } from "@modules/domain/work-items"
import { LeadActionsError, LeadActionsErrorCode } from "./errors/lead-actions.error"
import type { LeadActionResult } from "./lead-actions.contracts"
import type { LeadActionRunRow } from "./persistence/lead-actions.rows"

@Injectable()
/** The existing authority engine's capture, draft and invoice paths, executed by the fenced lead-actions job. */
export class LeadActionFlowService {
    constructor(
        private readonly leads: LeadRecordsService,
        private readonly inbound: InboundEventsService,
        private readonly commands: CommandBusService,
        private readonly engine: WorkEngineService,
        private readonly items: WorkItemsService,
        private readonly responsibilities: ResponsibilityJournalService,
        private readonly automations: AutomationsService,
    ) {}

    /** Records manual input, captures through the chatbot gate, then processes this lead's Sales context and owner chain. */
    async create(ctx: WorkContext, run: LeadActionRunRow): Promise<LeadActionResult> {
        const input = run.input
        const contact = input.phone?.trim() || input.email?.trim() || null
        const event = await this.inbound.recordInput({
            workspaceId: ctx.workspaceId,
            channel: "manual",
            kind: "lead",
            senderName: input.contactName ?? "",
            senderContact: contact,
            body: input.need ?? "",
            externalRef: `${input.channel ?? ""}:${input.company ?? ""}`,
            eventId: run.id,
        })
        const key = `handoff_lead:inbound:${event.inboundEventId}`
        const item = await this.commands.sendCommandItem(ctx, {
            from: "owner",
            to: "chatbot",
            command: "handoff_lead",
            reason: "manual lead",
            inboundEventId: event.inboundEventId,
            dedupeKey: key,
            payload: {
                subject_type: "inbound",
                subject_id: event.inboundEventId,
                contact_name: input.contactName ?? "",
                company: input.company ?? "",
                need: input.need ?? "",
                contact,
                phone: input.phone ?? null,
                email: input.email ?? null,
                channel_label: input.channel ?? "",
            },
        })
        const captured = await this.requireWork(ctx, item, key)
        const leadId =
            captured.lead_id ?? (await this.inbound.find(ctx.workspaceId, event.inboundEventId))?.lead_id ?? null
        if (leadId !== null) {
            await this.leads.fillContact({
                workspaceId: ctx.workspaceId,
                leadId,
                phone: contactParts(input.phone).phone,
                email: contactParts(input.email).email,
            })
        }
        if (captured.status === "done") await this.continueCapture(ctx, captured)
        return { leadId, workItemId: captured.id }
    }

    /** Drafts the owning agent's next step through the gate: automatic delivery or the existing approval card. */
    async draft(ctx: WorkContext, run: LeadActionRunRow): Promise<LeadActionResult> {
        const responsibility = await this.responsibilities.find(ctx.workspaceId, run.input.responsibilityId ?? "")
        if (responsibility === null) throw new LeadActionsError({ code: LeadActionsErrorCode.NotFound })
        const lead = await this.leads.require(ctx.workspaceId, responsibility.lead_id)
        const key = `send_follow_up:resp:${responsibility.id}:${run.id}`
        const item = await this.engine.runWork(ctx, {
            action: "send_follow_up",
            subject_type: "lead",
            subject_id: lead.id,
            lead_id: lead.id,
            dedupeKey: key,
            noChain: true,
            seed: { fields: { responsibility_id: responsibility.id } },
        })
        const drafted = await this.requireWork(ctx, item, key)
        const current = await this.items.findByDedupe(ctx.workspaceId, key)
        return {
            leadId: lead.id,
            responsibilityId: responsibility.id,
            workItemId: drafted.id,
            executionId: current?.execution_id ?? drafted.execution_id,
        }
    }

    /** Prepares the invoice through Accounting's authority and publishes the existing automation event once per won lead. */
    async settleWon(ctx: WorkContext, run: LeadActionRunRow): Promise<LeadActionResult> {
        const lead = await this.leads.require(ctx.workspaceId, run.input.leadId ?? "")
        if (lead.stage !== "won") throw new LeadActionsError({ code: LeadActionsErrorCode.NotWon })
        const key = `issue_invoice:lead:${lead.id}`
        const item = await this.engine.runWork(ctx, {
            action: "issue_invoice",
            subject_type: "lead",
            subject_id: lead.id,
            lead_id: lead.id,
            dedupeKey: key,
            seed: { amount_vnd: null, fields: {} },
        })
        const invoice = await this.requireWork(ctx, item, key)
        await this.automations.emit(run.requested_by, ctx.workspaceId, {
            event: "deal.won",
            dedupe: `deal.won:${lead.id}`,
            data: {
                lead_id: lead.id,
                name: lead.contact_name,
                company: lead.company,
                channel: lead.channel,
                need: lead.need,
                evidence: run.input.evidence || null,
            },
        })
        return { leadId: lead.id, workItemId: invoice.id }
    }

    private async continueCapture(ctx: WorkContext, captured: WorkItem): Promise<void> {
        const classificationKey = `classify_lead:after:${captured.id}`
        const candidate = await this.items.findByDedupe(ctx.workspaceId, classificationKey)
        if (candidate === null) return
        const classified = await this.requireWork(ctx, candidate, classificationKey)
        if (classified.status !== "done") return
        const followKey = `send_follow_up:after:${classified.id}`
        const follow = await this.items.findByDedupe(ctx.workspaceId, followKey)
        if (follow !== null) await this.requireWork(ctx, follow, followKey)
    }

    private async requireWork(ctx: WorkContext, item: WorkItem, key: string): Promise<WorkItem> {
        const processed = item.status === "queued" ? await this.engine.runQueuedItem(ctx, item.id) : item
        const current = processed ?? (await this.items.findByDedupe(ctx.workspaceId, key))
        if (current?.status === "queued") {
            throw new LeadActionsError({ code: LeadActionsErrorCode.Busy })
        }
        if (current === null || current.status === "failed" || current.status === "rejected") {
            throw new LeadActionsError({ code: LeadActionsErrorCode.WorkFailed, params: { workItemId: item.id } })
        }
        return current
    }
}
