import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { WorkItemsDecisionsReadService, WorkItemsService } from "@modules/domain/work-items"
import { InjectAfterCommit, type AfterCommit } from "@modules/platform/database"
import { InjectMessageCatalog, type MessageCatalog } from "@modules/platform/i18n"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { DecisionLogReadService } from "./decision-log-read.service"
import type { WorkContext } from "./decisions.contracts"
import { WorkItemClosedService } from "./work-item-closed.service"
import { WorkEngineLogEvent } from "./work-engine.log-events"
import { InjectWorkPerformerRegistry, type WorkPerformerRegistry } from "./work-performer.port"
import { WorkRecorderService } from "./work-recorder.service"
import type { WorkTimeoutClaim } from "./work-decision-timeout.contracts"

/** The existing graph stop policy names NIVO; it never invents a human principal. */
const BY = { name: "NIVO", kind: "staff" } as const

@Injectable()
/** Serializes deadline policy with the work item's human decision and persists graph stops without external effects in the transaction. */
export class WorkDecisionTimeoutService {
    constructor(
        private readonly reads: WorkItemsDecisionsReadService,
        private readonly items: WorkItemsService,
        private readonly decisions: DecisionLogReadService,
        private readonly recorder: WorkRecorderService,
        private readonly closed: WorkItemClosedService,
        @InjectWorkPerformerRegistry() private readonly registry: WorkPerformerRegistry,
        @InjectAfterCommit() private readonly afterCommit: AfterCommit,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** A queued owner decision defers the clock; a closed one is replayed with its actual recorded principal. */
    async claim(manager: EntityManager, workspaceId: string, itemId: string): Promise<WorkTimeoutClaim> {
        const claim = await this.reads.claimDecision(manager, workspaceId, itemId)
        if (claim.kind !== "closed") return claim
        const item = claim.item
        const memberId = (await this.decisions.decidersOf([item.id], manager)).get(item.id) ?? null
        return { kind: "closed", item, memberId }
    }

    /** Applies only a published stop policy; backup or agent-owner policies never call this close. */
    async reject(manager: EntityManager, workspaceId: string, itemId: string): Promise<boolean> {
        const item = await this.reads.lockForDecision(manager, workspaceId, itemId)
        if (item?.status !== "waiting_decision") return false
        const ctx: WorkContext = { workspaceId, actor: BY.name, locale: "vi" }
        const rejected = await this.items.markRejected(
            item.id,
            item.proposal,
            {
                summary: this.catalog.get("engine.rejectedResult", {}, ctx.locale),
            },
            manager,
        )
        await this.recorder.recordRejected(manager, ctx, item, item.proposal, BY, null)
        await this.afterCommit.run(manager, async () => {
            try {
                await this.registry.performerOf(item.action)?.onReject?.(ctx, item, item.proposal, BY)
                await this.recorder.rejected(ctx, item, item.proposal, BY, null, true)
                await this.closed.tell(ctx, rejected, BY)
            } catch (cause) {
                this.logger.error(WorkEngineLogEvent.ClosedNotificationFailed, cause, { workItemId: item.id })
            }
        })
        return true
    }
}
