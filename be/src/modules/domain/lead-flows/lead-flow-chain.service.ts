import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import type { LeadGenFlow, WorkContext, WorkItem } from "@modules/domain/decisions"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { LeadGenQueue } from "@modules/queues/lead-gen"

@Injectable()
/**
 * The lead generation flow as the work engine sees it (its `LeadGenFlow` port): what follows a finished lead_gen step is decided by
 * the flow's own state machine, in a job of its own, so the engine never waits for the next step (or its model call).
 */
export class LeadFlowChainService implements LeadGenFlow {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly queue: LeadGenQueue,
    ) {}

    /** Queues the continuation of a finished lead_gen step; the same step twice is one continuation. */
    async continueAfter(ctx: WorkContext, item: WorkItem): Promise<void> {
        await this.entityManager.transaction((manager) =>
            this.queue.enqueue(
                {
                    workspaceId: ctx.workspaceId,
                    locale: ctx.locale,
                    inboundEventId: item.inbound_event_id,
                    step: {
                        id: item.id,
                        action: item.action,
                        leadId: item.lead_id,
                        chainId: item.chain_id,
                        origin: item.origin,
                        fields: item.proposal.fields,
                        draft: item.proposal.draft ?? "",
                    },
                },
                manager,
            ),
        )
    }
}
