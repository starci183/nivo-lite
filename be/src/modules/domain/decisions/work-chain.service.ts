import { Injectable } from "@nestjs/common"
import { LeadReadService } from "@modules/domain/leads"
import { WorkItemsLeadReadService } from "@modules/domain/work-items"
import { CommandPlannerService } from "./command-planner.service"
import type { SendCommandInput, WorkContext, WorkItem } from "./decisions.contracts"
import { ModuleCatalogService } from "./module-catalog.service"
import { InjectLeadGenFlow } from "./work-engine.decorators"
import type { LeadGenFlow } from "./work-engine.port"
import { WorkIntakeService } from "./work-intake.service"

@Injectable()
/**
 * What follows a finished item: the next department's step of the registry, queued as a typed command. Every hand-off goes
 * through the planner (contract, depth and cycle checks) and is only inserted, never processed here; the receiver's own gate
 * decides it when `runQueued` takes it.
 */
export class WorkChainService {
    constructor(
        private readonly leads: LeadReadService,
        private readonly waitingWork: WorkItemsLeadReadService,
        @InjectLeadGenFlow() private readonly leadGen: LeadGenFlow,
        private readonly modules: ModuleCatalogService,
        private readonly planner: CommandPlannerService,
        private readonly intake: WorkIntakeService,
    ) {}

    /** Queues the next department's step for a finished item. */
    async continueChain(ctx: WorkContext, item: WorkItem): Promise<void> {
        // Lead generation steps chain by the lead flow's own state machine; only the hand-off to sales uses the generic loop.
        if (item.department === "lead_gen" && item.action !== "handoff_to_sales") {
            await this.leadGen.continueAfter(ctx, item)
            return
        }
        const entry = await this.modules.actionOf(item.action)
        await this.each(ctx, item, entry?.next ?? [])
    }

    /** The one invoice a payment settled, when the proposal names exactly one candidate. */
    private settledInvoice(item: WorkItem): string | null {
        const [only, other] = item.proposal.candidates ?? []
        return only !== undefined && other === undefined ? only.id : null
    }

    private async each(ctx: WorkContext, item: WorkItem, remaining: ReadonlyArray<string>): Promise<void> {
        const [next, ...rest] = remaining
        if (next === undefined) return
        await this.step(ctx, item, next)
        await this.each(ctx, item, rest)
    }

    private async step(ctx: WorkContext, item: WorkItem, next: string): Promise<void> {
        const target = await this.modules.actionOf(next)
        if (target === null) return
        const chain = {
            from: item.department,
            to: target.moduleKey,
            command: next,
            parentId: item.id,
            chainId: item.chain_id ?? item.id,
            inboundEventId: item.inbound_event_id,
            queue: true,
        } as const
        const leadId = item.lead_id
        if (next === "classify_lead" && leadId !== null) {
            await this.enqueue(ctx, {
                ...chain,
                reason: "handoff",
                dedupeKey: `classify_lead:after:${item.id}`,
                payload: { subject_type: "lead", subject_id: leadId, lead_id: leadId },
            })
        } else if (next === "send_follow_up" && leadId !== null) {
            if (!(await this.followUpWanted(ctx, item, leadId))) return
            await this.enqueue(ctx, {
                ...chain,
                reason: "classified",
                dedupeKey: `send_follow_up:after:${item.id}`,
                payload: { subject_type: "lead", subject_id: leadId, lead_id: leadId },
            })
        } else if (next === "issue_invoice" && item.subject_type === "order" && item.subject_id !== null) {
            await this.enqueue(ctx, {
                ...chain,
                reason: "order_confirmed",
                dedupeKey: `issue_invoice:order:${item.subject_id}`,
                payload: { subject_type: "order", subject_id: item.subject_id, lead_id: leadId },
            })
        } else if (next === "send_care" && this.isPaymentSubject(item) && item.subject_id !== null && leadId !== null) {
            // One care message per paid invoice, whichever way it was confirmed (a bank credit, or the owner checking a claim).
            const invoiceId = this.settledInvoice(item)
            await this.enqueue(ctx, {
                ...chain,
                reason: "payment_confirmed",
                dedupeKey:
                    invoiceId === null ? `send_care:transaction:${item.subject_id}` : `send_care:invoice:${invoiceId}`,
                payload: {
                    subject_type: item.subject_type,
                    subject_id: item.subject_id,
                    lead_id: leadId,
                    ...(invoiceId === null ? {} : { invoice_id: invoiceId }),
                },
            })
        }
    }

    private isPaymentSubject(item: WorkItem): boolean {
        return item.subject_type === "transaction" || item.subject_type === "invoice"
    }

    /** A lost lead, a customer who already bought and a customer with a follow-up already waiting get no new follow-up. */
    private async followUpWanted(ctx: WorkContext, item: WorkItem, leadId: string): Promise<boolean> {
        if (item.proposal.fields.stage === "lost") return false
        const [lead] = await this.leads.cardsOf(ctx.workspaceId, [leadId])
        if (lead?.stage === "won") return false
        return !(await this.waitingWork.hasWaiting(ctx.workspaceId, leadId, "send_follow_up"))
    }

    /** A hand-off is a typed command: a refusal is logged by the planner and never stops the finished item. */
    private async enqueue(ctx: WorkContext, input: SendCommandInput): Promise<void> {
        const plan = await this.planner.plan(ctx, input)
        if (plan.ok) await this.intake.insert(ctx, { ...plan.spec, queue: true })
    }
}
