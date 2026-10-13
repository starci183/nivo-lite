import { Injectable } from "@nestjs/common"
import { WorkEngineService } from "@modules/domain/decisions"
import type { WorkContext, WorkItem } from "@modules/domain/decisions"
import { InboundEventsService } from "@modules/domain/inbound-events"
import type { OptionalInboundEvent } from "@modules/domain/inbound-events"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { CLAIM_LEASE_SECONDS, WorkItemsService } from "@modules/domain/work-items"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import type { SimulateInboundPayload } from "@modules/queues/decisions"
import { InboxSimulationError, InboxSimulationErrorCode } from "./errors/inbox-simulation.error"

@Injectable()
/** The fenced decisions job's simulator work: it follows the existing lead, order and payment department engine, away from the request. */
export class InboxSimulationWorkerService {
    constructor(
        private readonly members: WorkspaceMembersService,
        private readonly inboundEvents: InboundEventsService,
        private readonly engine: WorkEngineService,
        private readonly workItems: WorkItemsService,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
    ) {}

    /** Rechecks the requesting member, processes the original stored event and drains the same queued follow-up chain as a live input. */
    async run(payload: SimulateInboundPayload): Promise<void> {
        const member = await this.members.require(payload.userId, payload.workspaceId)
        const event = await this.inboundEvents.find(payload.workspaceId, payload.inboundEventId)
        if (event === null || event.origin !== "simulated") {
            throw new InboxSimulationError({ code: InboxSimulationErrorCode.NotFound })
        }
        const ctx: WorkContext = { workspaceId: payload.workspaceId, actor: member.displayName, locale: payload.locale }
        const item = await this.start(ctx, event, payload.items)
        await this.inboundEvents.mark(payload.workspaceId, event.id, this.eventStatus(item), item.lead_id)
        if (item.status === "failed")
            throw new InboxSimulationError({ code: InboxSimulationErrorCode.Failed, params: { unrecoverable: 1 } })
        await this.finish(ctx, event.id, item)
    }

    private async finish(ctx: WorkContext, eventId: string, item: WorkItem): Promise<void> {
        await this.engine.runInboundQueued(ctx, eventId, 20)
        const state = await this.workItems.inboundState(ctx.workspaceId, eventId)
        if (state.failed > 0) {
            await this.inboundEvents.mark(ctx.workspaceId, eventId, "failed", null)
            throw new InboxSimulationError({ code: InboxSimulationErrorCode.Failed, params: { unrecoverable: 1 } })
        }
        if (state.queued > 0) {
            throw new InboxSimulationError({
                code: InboxSimulationErrorCode.Pending,
                params: { retryAfterSeconds: CLAIM_LEASE_SECONDS },
            })
        }
        const refreshed =
            item.status === "queued"
                ? await this.workItems.findByDedupe(ctx.workspaceId, `${item.action}:inbound:${eventId}`)
                : item
        if (refreshed === null)
            throw new InboxSimulationError({ code: InboxSimulationErrorCode.Failed, params: { unrecoverable: 1 } })
        await this.inboundEvents.mark(
            ctx.workspaceId,
            eventId,
            state.waiting > 0 ? "needs_decision" : this.eventStatus(refreshed),
            refreshed.lead_id,
        )
    }

    private start(ctx: WorkContext, event: NonNullable<OptionalInboundEvent>, items: string): Promise<WorkItem> {
        const source = { id: event.id, origin: "simulated" as const }
        if (event.kind === "order") {
            return this.engine.startOrderWork(ctx, source, { items, amount_vnd: event.amount_vnd })
        }
        if (event.kind === "payment") {
            return this.engine.startInboundWork(
                ctx,
                source,
                "reconcile_payment",
                { amount_vnd: event.amount_vnd, fields: {} },
                null,
            )
        }
        return this.engine.startInboundWork(
            ctx,
            source,
            "handoff_lead",
            {
                fields: {
                    contact_name: event.sender_name ?? "",
                    company: "",
                    need: event.body,
                    contact: event.sender_contact,
                    channel_label: this.catalog.get(`inboxSimulation.channel.${event.channel}`, {}, ctx.locale),
                },
            },
            null,
        )
    }

    private eventStatus(item: WorkItem): "received" | "processed" | "needs_decision" | "failed" {
        if (item.status === "waiting_decision") return "needs_decision"
        if (item.status === "queued") return "received"
        return item.status === "failed" ? "failed" : "processed"
    }
}
