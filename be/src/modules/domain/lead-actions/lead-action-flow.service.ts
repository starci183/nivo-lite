import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { WorkEngineService } from "@modules/domain/decisions"
import type { WorkContext, WorkItem } from "@modules/domain/decisions"
import { EventsService } from "@modules/domain/events"
import { InboundEventsService } from "@modules/domain/inbound-events"
import { LeadRecordsService, contactParts } from "@modules/domain/leads"
import { ResponsibilityJournalService } from "@modules/domain/responsibilities"
import { WorkItemsService } from "@modules/domain/work-items"
import { DealWonEvent, LeadCapturedEvent, whenPresent } from "@modules/events/api"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectEventBus } from "@modules/platform/event-bus"
import type { EventBus } from "@modules/platform/event-bus"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LeadActionsError, LeadActionsErrorCode } from "./errors/lead-actions.error"
import type { LeadActionResult, LeadActionRun } from "./lead-actions.contracts"

@Injectable()
/** Core customer creation and the authority engine's draft and invoice paths, executed by the fenced lead-actions job. */
export class LeadActionFlowService {
    constructor(
        private readonly leads: LeadRecordsService,
        private readonly inbound: InboundEventsService,
        private readonly events: EventsService,
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectEventBus() private readonly eventBus: EventBus,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly engine: WorkEngineService,
        private readonly items: WorkItemsService,
        private readonly responsibilities: ResponsibilityJournalService,
    ) {}

    /** Creates a customer from the core surface and assigns a follow-up, independently of installed agent modules. */
    async create(ctx: WorkContext, run: LeadActionRun): Promise<LeadActionResult> {
        const input = run.input
        const phone = contactParts(input.phone).phone
        const email = contactParts(input.email).email
        const event = await this.inbound.recordInput({
            workspaceId: ctx.workspaceId,
            channel: "manual",
            kind: "lead",
            senderName: input.contactName ?? "",
            senderContact: input.phone?.trim() || input.email?.trim() || null,
            body: input.need ?? "",
            externalRef: `${input.channel ?? ""}:${input.company ?? ""}`,
            eventId: run.id,
        })
        const linked = await this.inbound.find(ctx.workspaceId, event.inboundEventId)
        const known = linked?.lead_id
            ? await this.leads.require(ctx.workspaceId, linked.lead_id)
            : await this.leads.match({
                  workspaceId: ctx.workspaceId,
                  phone,
                  email,
                  name: input.contactName ?? "",
                  channel: input.channel ?? "",
              })
        const lead =
            known ??
            (await this.entityManager.transaction(async (manager) => {
                const created = await this.leads.capture(
                    {
                        workspaceId: ctx.workspaceId,
                        contactName: input.contactName ?? "",
                        company: input.company ?? "",
                        channel: input.channel ?? "",
                        need: input.need ?? "",
                        phone,
                        email,
                    },
                    manager,
                )
                await this.eventBus.publish(
                    LeadCapturedEvent.create({
                        workspaceId: ctx.workspaceId,
                        leadId: created.id,
                        contactName: created.contact_name,
                        company: created.company,
                        channel: created.channel,
                        need: created.need,
                        ...whenPresent("phone", created.phone),
                        ...whenPresent("email", created.email),
                    }),
                    manager,
                    `lead-captured:${created.id}`,
                )
                return created
            }))
        if (known === null) {
            await this.events.record({
                workspaceId: ctx.workspaceId,
                leadId: lead.id,
                kind: "lead.captured",
                actor: ctx.actor,
                summary: this.catalog.get("lead-actions.captured", { channel: lead.channel }, ctx.locale),
            })
        } else {
            await this.leads.fillContact({ workspaceId: ctx.workspaceId, leadId: lead.id, phone, email })
        }
        await this.inbound.mark(ctx.workspaceId, event.inboundEventId, "processed", lead.id)
        const responsibility = await this.responsibilities.ensureFor(ctx, lead.id)
        return { leadId: lead.id, responsibilityId: responsibility.id }
    }

    /** Drafts the owning agent's next step through the gate: automatic delivery or the existing approval card. */
    async draft(ctx: WorkContext, run: LeadActionRun): Promise<LeadActionResult> {
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
    async settleWon(ctx: WorkContext, run: LeadActionRun): Promise<LeadActionResult> {
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
        await this.entityManager.transaction((manager) =>
            this.eventBus.publish(
                DealWonEvent.create({
                    workspaceId: ctx.workspaceId,
                    leadId: lead.id,
                    name: lead.contact_name,
                    ...whenPresent("company", lead.company),
                    ...whenPresent("channel", lead.channel),
                    ...whenPresent("need", lead.need),
                    ...whenPresent("evidence", run.input.evidence || undefined),
                }),
                manager,
                `deal-won:${lead.id}`,
            ),
        )
        return { leadId: lead.id, workItemId: invoice.id }
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
