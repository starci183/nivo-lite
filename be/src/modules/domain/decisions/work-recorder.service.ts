import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { DecisionMadeEvent, whenPresent } from "@modules/events/api"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectEventBus } from "@modules/platform/event-bus"
import type { EventBus } from "@modules/platform/event-bus"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type {
    Decider,
    DecisionEntry,
    InboundStatus,
    OptionalRejectionNote,
    Performed,
    Proposal,
    WorkContext,
    WorkItem,
} from "./decisions.contracts"
import { WorkLinesService } from "./work-lines.service"
import { EvidenceService } from "./evidence.service"
import { ModuleCatalogService } from "./module-catalog.service"
import type { FinishPlan } from "./work-engine.contracts"
import { InjectInboundEventStatus } from "./work-engine.decorators"
import { WorkEngineLogEvent } from "./work-engine.log-events"
import type { InboundEventStatus } from "./work-engine.port"

@Injectable()
/** What the engine tells people and other systems once an item changed: the decision log, the evidence log, the team chat, the inbound event and the outbound event stream. */
export class WorkRecorderService {
    constructor(
        @InjectLogger() private readonly logger: Logger,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @InjectInboundEventStatus() private readonly inbound: InboundEventStatus,
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectEventBus() private readonly eventBus: EventBus,
        private readonly modules: ModuleCatalogService,
        private readonly evidence: EvidenceService,
        private readonly lines: WorkLinesService,
    ) {}

    /**
     * An item was performed and closed. `item` is the item as it was decided (its reason is what the person answered), `done`
     * the closed row. The automatic path logs a policy decision; a person's path logs theirs and publishes `decision.made`.
     */
    async finished(
        ctx: WorkContext,
        item: WorkItem,
        done: WorkItem,
        proposal: Proposal,
        plan: FinishPlan,
        res: Performed,
        decisionRecorded: boolean = false,
    ): Promise<void> {
        const dept = await this.modules.nameOf(done.department, ctx.locale)
        const decision = {
            work_item_id: done.id,
            lead_id: done.lead_id,
            department: done.department,
            action: done.action,
        }
        const line = { department: done.department, installationId: done.installation_id }
        if (plan.path === "auto") {
            await this.evidence.decide(ctx, {
                ...decision,
                decided_by: "NIVO",
                decider_kind: "policy",
                outcome: "auto_done",
                reason: "routine",
                note: res.summary,
            })
            await this.evidence.log(ctx, {
                lead_id: done.lead_id,
                work_item_id: done.id,
                kind: "work.auto_done",
                actor: dept,
                summary: res.summary,
                evidence: res.detail ?? null,
            })
            await this.lines.say(ctx, {
                ...line,
                body: this.catalog.get("engine.auto", { dept, summary: res.summary }, ctx.locale),
                key: `auto:${done.id}`,
            })
        } else {
            if (!decisionRecorded) {
                await this.entityManager.transaction((manager) =>
                    this.recordFinished(manager, ctx, item, done, proposal, plan, res),
                )
            }
            await this.evidence.log(ctx, {
                lead_id: done.lead_id,
                work_item_id: done.id,
                kind: "work.resumed",
                actor: plan.by.name,
                summary: res.summary,
                evidence: res.detail ?? null,
            })
            await this.lines.say(ctx, {
                ...line,
                body: this.catalog.get("engine.resumed", { user: plan.by.name, summary: res.summary }, ctx.locale),
                key: `resumed:${done.id}`,
            })
        }
        await this.markInbound(ctx, done, "processed", done.lead_id)
    }

    /** A person rejected the item and the work stopped. */
    async rejected(
        ctx: WorkContext,
        item: WorkItem,
        merged: Proposal,
        by: Decider,
        note: OptionalRejectionNote,
        decisionRecorded: boolean = false,
    ): Promise<void> {
        if (!decisionRecorded)
            await this.entityManager.transaction((manager) => this.recordRejected(manager, ctx, item, merged, by, note))
        const body = this.catalog.get("engine.rejected", { user: by.name, summary: item.proposal.summary }, ctx.locale)
        await this.evidence.log(ctx, {
            lead_id: item.lead_id,
            work_item_id: item.id,
            kind: "work.rejected",
            actor: by.name,
            summary: body,
            evidence: note,
        })
        await this.lines.say(ctx, {
            department: item.department,
            installationId: item.installation_id,
            body,
            key: `rejected:${item.id}`,
        })
        await this.markInbound(ctx, item, "processed", null)
    }

    /** Writes the approved snapshot, principal and decision event in the item's closing transaction. */
    recordFinished(
        manager: EntityManager,
        ctx: WorkContext,
        item: WorkItem,
        done: WorkItem,
        proposal: Proposal,
        plan: FinishPlan,
        res: Performed,
    ): Promise<void> {
        return this.decideIn(
            manager,
            ctx,
            done,
            {
                work_item_id: done.id,
                lead_id: done.lead_id,
                department: done.department,
                action: done.action,
                decided_by: plan.by.name,
                decider_kind: plan.by.kind,
                decided_by_member_id: plan.by.memberId ?? null,
                outcome: plan.outcome,
                reason: item.reason,
                note: plan.note ?? res.summary,
                before: plan.before ?? null,
                after: proposal,
            },
            res.summary,
        )
    }

    /** Writes a rejection and its principal in the item's closing transaction. */
    recordRejected(
        manager: EntityManager,
        ctx: WorkContext,
        item: WorkItem,
        merged: Proposal,
        by: Decider,
        note: OptionalRejectionNote,
    ): Promise<void> {
        return this.decideIn(
            manager,
            ctx,
            item,
            {
                work_item_id: item.id,
                lead_id: item.lead_id,
                department: item.department,
                action: item.action,
                decided_by: by.name,
                decider_kind: by.kind,
                decided_by_member_id: by.memberId ?? null,
                outcome: "rejected",
                reason: item.reason,
                note,
                before: item.proposal,
                after: merged,
            },
            item.proposal.summary,
        )
    }

    /**
     * An item failed: the log, the team chat and the inbound event hear of it, and none of them can fail the failure. Only the work
     * the input started marks the input failed: a later step of its chain (the care message after a reconciled credit, say)
     * fails on its own work item and leaves the input where its own work put it.
     */
    async failed(ctx: WorkContext, item: WorkItem, text: string): Promise<void> {
        const dept = await this.modules.nameOf(item.department, ctx.locale)
        const action = (await this.modules.actionOf(item.action))?.label[ctx.locale] ?? item.action
        const body = this.catalog.get("engine.failed", { dept, action, error: text }, ctx.locale)
        await this.safely(
            () =>
                this.evidence.log(ctx, {
                    lead_id: item.lead_id,
                    work_item_id: item.id,
                    kind: "work.failed",
                    actor: "NIVO",
                    summary: body,
                }),
            WorkEngineLogEvent.EvidenceFailed,
        )
        await this.safely(
            () =>
                this.lines.say(ctx, {
                    department: item.department,
                    installationId: item.installation_id,
                    body,
                    key: `failed:${item.id}`,
                }),
            WorkEngineLogEvent.LineFailed,
        )
        if (item.parent_id !== null) return
        await this.safely(() => this.markInbound(ctx, item, "failed", null), WorkEngineLogEvent.InboundStatusFailed)
    }

    private async markInbound(
        ctx: WorkContext,
        item: WorkItem,
        status: InboundStatus,
        leadId: string | null,
    ): Promise<void> {
        if (item.inbound_event_id !== null) await this.inbound.mark(ctx, item.inbound_event_id, status, leadId)
    }

    /**
     * Writes a person's decision and announces `decision_made` in the same transaction, so the decision and its fact stand or fall
     * together; the event bus hears it only once the decision has committed.
     */
    private async decideIn(
        manager: EntityManager,
        ctx: WorkContext,
        item: WorkItem,
        entry: DecisionEntry,
        summary: string,
    ): Promise<void> {
        await this.evidence.decide(ctx, entry, manager)
        await this.eventBus.publish(
            DecisionMadeEvent.create({
                workspaceId: ctx.workspaceId,
                workItemId: item.id,
                action: item.action,
                department: item.department,
                outcome: entry.outcome,
                decidedBy: entry.decided_by,
                ...whenPresent("leadId", item.lead_id),
                summary,
            }),
            manager,
            `decision-made:${item.id}:${entry.outcome}`,
        )
    }

    private async safely(run: () => Promise<void>, event: WorkEngineLogEvent): Promise<void> {
        try {
            await run()
        } catch (cause) {
            this.logger.error(event, cause)
        }
    }
}
