import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AgentsService } from "@modules/domain/agents"
import { EvidenceService } from "@modules/domain/decisions"
import type {
    Performed,
    PerformedBy,
    Prepared,
    Proposal,
    WorkContext,
    WorkItem,
    WorkPerformer,
} from "@modules/domain/decisions"
import { InboundEventsService } from "@modules/domain/inbound-events"
import type { OptionalInboundEvent } from "@modules/domain/inbound-events"
import { LeadRecordsService, contactParts } from "@modules/domain/leads"
import type { LeadRecordRow } from "@modules/domain/leads"
import { OrdersService } from "@modules/domain/orders"
import type { OptionalOrder } from "@modules/domain/orders"
import { ResponsibilityJournalService } from "@modules/domain/responsibilities"
import { DealWonEvent, LeadCapturedEvent, OrderConfirmedEvent, whenPresent } from "@modules/events/api"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectEventBus } from "@modules/platform/event-bus"
import type { EventBus } from "@modules/platform/event-bus"
import { WorkPerformersError, WorkPerformersErrorCode } from "./errors/work-performers.error"
import { InjectPromptWriter } from "./work-performers.decorators"
import type { PromptWriter } from "./work-performers.port"
import { PerformerKitService } from "./performer-kit.service"
import { firstText, leadHref, numberOf, textOf } from "./performer.policy"

@Injectable()
/** `confirm_order`: Sales confirms the order of an input (the order is drafted first, so the owner sees its number); the deal is won. */
export class ConfirmOrderPerformerService implements WorkPerformer {
    constructor(
        private readonly kit: PerformerKitService,
        private readonly orders: OrdersService,
        private readonly leads: LeadRecordsService,
        private readonly inbound: InboundEventsService,
        private readonly agents: AgentsService,
        private readonly responsibilities: ResponsibilityJournalService,
        @InjectPromptWriter() private readonly prompts: PromptWriter,
        private readonly evidence: EvidenceService,
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectEventBus() private readonly bus: EventBus,
    ) {}

    /** Drafts the order of the input (reading it with one model call only when the channel gave no amount) and finds its customer. */
    async prepare(ctx: WorkContext, item: WorkItem): Promise<Prepared> {
        const event = await this.eventOf(ctx, item)
        const fields = item.proposal.fields
        const given = numberOf(fields.amount_vnd) ?? item.proposal.amount_vnd ?? event?.amount_vnd ?? null
        const read =
            given === null && event !== null && event.body.trim() !== ""
                ? await this.prompts.extractOrder(this.kit.scope(ctx), event.body)
                : null
        const amount = given ?? read?.amount_vnd ?? null
        const items = firstText([textOf(fields.items), read?.items ?? "", event?.body.trim() ?? ""])
        const lead = await this.leadFor(ctx, item, event, items)
        const order = await this.orderOf(ctx, item, event, lead, items, amount)
        if (item.inbound_event_id !== null)
            await this.inbound.mark(ctx.workspaceId, item.inbound_event_id, null, lead.id)
        const summary = this.kit.text(ctx, "orderSummary", {
            no: order.order_no,
            name: lead.contact_name,
            items: items === "" ? "—" : items,
            amount: this.kit.money(ctx, amount),
        })
        return {
            proposal: {
                summary,
                amount_vnd: amount,
                fields: { customer: lead.contact_name, items, amount_vnd: amount, order_no: order.order_no },
            },
            patch: { subject_type: "order", subject_id: order.id, lead_id: lead.id },
        }
    }

    /**
     * Confirms the draft once (a repeat never re-confirms or rolls back), marks the deal won, leaves the evidence line and publishes
     * `order_confirmed` and `deal_won`, all in one transaction.
     */
    async perform(ctx: WorkContext, item: WorkItem, proposal: Proposal, by: PerformedBy): Promise<Performed> {
        const orderId = this.orderIdOf(item)
        const amount = proposal.amount_vnd ?? numberOf(proposal.fields.amount_vnd)
        const confirmed = await this.entityManager.transaction(async (tx) => {
            const order = await this.orders.confirm(
                {
                    workspaceId: ctx.workspaceId,
                    orderId,
                    amountVnd: amount,
                    items: textOf(proposal.fields.items),
                    confirmedBy: by.name,
                },
                tx,
            )
            if (order === null) return null
            if (order.lead_id !== null) await this.leads.markWon(ctx.workspaceId, order.lead_id, tx)
            const summary = this.kit.text(ctx, "orderConfirmed", {
                no: order.order_no,
                amount: this.kit.money(ctx, amount),
            })
            await this.evidence.log(
                ctx,
                {
                    lead_id: order.lead_id,
                    work_item_id: item.id,
                    kind: "order.confirmed",
                    actor: by.name,
                    summary,
                    evidence: textOf(proposal.fields.items) === "" ? null : textOf(proposal.fields.items),
                },
                tx,
            )
            await this.publishConfirmed(ctx, order, proposal, by, amount, tx)
            return { order, summary }
        })
        if (confirmed === null) return this.alreadyConfirmed(ctx, orderId)
        return {
            summary: confirmed.summary,
            evidence: "captured",
            href: leadHref(confirmed.order.lead_id),
            lead_id: confirmed.order.lead_id,
        }
    }

    /** `order_confirmed` for the order, and `deal_won` for its customer when it has one: the reactors listening hear them once committed. */
    private async publishConfirmed(
        ctx: WorkContext,
        order: NonNullable<OptionalOrder>,
        proposal: Proposal,
        by: PerformedBy,
        amount: number | null,
        tx: EntityManager,
    ): Promise<void> {
        const buyer = order.lead_id === null ? null : await this.leads.find(ctx.workspaceId, order.lead_id)
        const customer = buyer?.contact_name ?? textOf(proposal.fields.customer)
        await this.bus.publish(
            OrderConfirmedEvent.create({
                workspaceId: ctx.workspaceId,
                orderId: order.id,
                orderNo: order.order_no,
                ...whenPresent("leadId", order.lead_id),
                customer,
                items: textOf(proposal.fields.items),
                ...whenPresent("amountVnd", amount),
                ...whenPresent("channel", buyer?.channel),
                confirmedBy: by.name,
            }),
            tx,
            `order_confirmed:${order.id}`,
        )
        if (order.lead_id === null) return
        await this.bus.publish(
            DealWonEvent.create({
                workspaceId: ctx.workspaceId,
                leadId: order.lead_id,
                name: customer,
                ...whenPresent("company", buyer?.company),
                ...whenPresent("channel", buyer?.channel),
                ...whenPresent("need", buyer?.need),
                orderNo: order.order_no,
                ...whenPresent("amountVnd", amount),
            }),
            tx,
            `deal_won:${order.lead_id}`,
        )
    }

    /** A rejection cancels the draft. */
    async onReject(ctx: WorkContext, item: WorkItem): Promise<void> {
        if (item.subject_type !== "order" || item.subject_id === null) return
        const order = await this.orders.cancel(ctx.workspaceId, item.subject_id)
        if (order === null) return
        await this.evidence.log(ctx, {
            lead_id: order.lead_id,
            work_item_id: item.id,
            kind: "order.cancelled",
            actor: ctx.actor,
            summary: this.kit.text(ctx, "orderCancelled", { no: order.order_no }),
        })
    }

    private async alreadyConfirmed(ctx: WorkContext, orderId: string): Promise<Performed> {
        const current = await this.orders.find(ctx.workspaceId, orderId)
        if (current === null || current.status === "cancelled") {
            throw new WorkPerformersError({ code: WorkPerformersErrorCode.OrderUnavailable })
        }
        return {
            summary: this.kit.text(ctx, "orderConfirmed", {
                no: current.order_no,
                amount: this.kit.money(ctx, current.amount_vnd),
            }),
            evidence: "captured",
            href: leadHref(current.lead_id),
            lead_id: current.lead_id,
        }
    }

    private orderIdOf(item: WorkItem): string {
        if (item.subject_id === null) throw new WorkPerformersError({ code: WorkPerformersErrorCode.SubjectMissing })
        return item.subject_id
    }

    private async eventOf(ctx: WorkContext, item: WorkItem): Promise<OptionalInboundEvent> {
        return item.inbound_event_id === null ? null : this.inbound.find(ctx.workspaceId, item.inbound_event_id)
    }

    private async orderOf(
        ctx: WorkContext,
        item: WorkItem,
        event: OptionalInboundEvent,
        lead: LeadRecordRow,
        items: string,
        amount: number | null,
    ) {
        const existing: OptionalOrder =
            item.subject_type === "order" && item.subject_id !== null
                ? await this.orders.find(ctx.workspaceId, item.subject_id)
                : null
        if (existing !== null) return existing
        const given = firstText([textOf(item.proposal.fields.order_no), event?.external_ref?.trim() ?? ""])
        return this.orders.draft({
            workspaceId: ctx.workspaceId,
            leadId: lead.id,
            inboundEventId: item.inbound_event_id,
            orderNo: given === "" ? null : given,
            items,
            amountVnd: amount,
        })
    }

    /** The customer of an input: the item's own, one that matches the sender, or a new one. */
    private async leadFor(
        ctx: WorkContext,
        item: WorkItem,
        event: OptionalInboundEvent,
        need: string,
    ): Promise<LeadRecordRow> {
        if (item.lead_id !== null) return this.leads.require(ctx.workspaceId, item.lead_id)
        const { phone, email } = contactParts(event?.sender_contact ?? null)
        const channel = event === null ? "" : this.kit.text(ctx, `channel.${event.channel}`)
        const known = await this.leads.match({
            workspaceId: ctx.workspaceId,
            phone,
            email,
            name: event?.sender_name ?? null,
            channel,
        })
        if (known !== null) return known
        const contactName = event?.sender_name ?? ""
        const channelLabel = channel === "" ? "—" : channel
        const actor =
            (await this.agents.agentOfDepartment(ctx.workspaceId, "chatbot", null))?.name ??
            (await this.kit.department(ctx, "chatbot"))
        const lead = await this.entityManager.transaction(async (tx) => {
            const created = await this.leads.capture(
                {
                    workspaceId: ctx.workspaceId,
                    contactName: contactName === "" ? this.kit.text(ctx, "notShared") : contactName,
                    company: this.kit.text(ctx, "notShared"),
                    channel: channelLabel,
                    need: need === "" ? "—" : need,
                    phone,
                    email,
                },
                tx,
            )
            await this.evidence.log(
                ctx,
                {
                    lead_id: created.id,
                    work_item_id: item.id,
                    kind: "lead.captured",
                    actor,
                    summary: this.kit.text(ctx, "capturedFrom", { channel: created.channel }),
                    evidence: event?.body === undefined || event.body === "" ? null : event.body,
                },
                tx,
            )
            await this.bus.publish(
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
                tx,
                `lead_captured:${created.id}`,
            )
            return created
        })
        await this.responsibilities.ensureFor(ctx, lead.id)
        return lead
    }
}
