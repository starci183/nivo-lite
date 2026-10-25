import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import type { DecisionEvents, DecisionPayload, WorkContext } from "@modules/domain/decisions"
import { WebhookEventsService } from "@modules/domain/webhook-connections"
import type { WebhookEvent } from "@modules/domain/webhook-connections"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectQueueOutbox } from "@modules/platform/queue"
import type { QueueOutbox } from "@modules/platform/queue"
import { AUTOMATION_QUEUE, AUTOMATION_TICK_JOB } from "@modules/queues/automation"
import type { BusinessEventPayload } from "@modules/queues/automation"
import type { EventData } from "./automations.contracts"

@Injectable()
/**
 * The business events of the work (`decision.made`, `order.confirmed`, `deal.won`, `payment.received`...), published the way the web
 * app's emitEvent did: the connected webhooks that picked the event get a signed delivery each, and the automation engine hears it on
 * the automation job (the pipelines that listen to it start, a waiting run settles). Both jobs are written in one transaction, and the
 * dedupe key makes a redelivery publish once.
 */
export class AutomationBusinessEventsService implements DecisionEvents {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectQueueOutbox() private readonly outbox: QueueOutbox,
        private readonly webhooks: WebhookEventsService,
    ) {}

    /** Queues `decision.made` for the automation engine and for the subscribed webhooks. */
    decisionMade(ctx: WorkContext, payload: DecisionPayload, dedupeKey: string): Promise<void> {
        return this.publish(ctx.workspaceId, "decision.made", payload, dedupeKey)
    }

    /** Queues one business event and its subscribed webhooks in the supplied transaction, or in one transaction of its own. */
    async publish(
        workspaceId: string,
        event: WebhookEvent,
        data: EventData,
        dedupe: string,
        manager?: EntityManager,
    ): Promise<void> {
        const job: BusinessEventPayload = { kind: "business_event", event, workspaceId, dedupe, data }
        if (manager !== undefined) return this.write(job, event, manager)
        await this.entityManager.transaction((tx) => this.write(job, event, tx))
    }

    private async write(job: BusinessEventPayload, event: WebhookEvent, tx: EntityManager): Promise<void> {
        await this.outbox.write(tx, AUTOMATION_QUEUE, job, { job: AUTOMATION_TICK_JOB, dedupeKey: job.dedupe })
        await this.webhooks.publish({ workspaceId: job.workspaceId, event, data: job.data, dedupe: job.dedupe }, tx)
    }
}
