import { Injectable, Optional } from "@nestjs/common"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import type { Decider, WorkContext, WorkItem } from "./decisions.contracts"
import { InjectWorkItemClosed } from "./work-engine.decorators"
import { WorkEngineLogEvent } from "./work-engine.log-events"
import type { WorkItemClosedHook } from "./work-engine.port"

@Injectable()
/**
 * Tells whoever waits on a work item that it closed by a person's decision. The closed item stays the record of the decision, so a hook that
 * throws only waits for the sweep of the runs; with no hook bound nobody waits and nothing is told.
 */
export class WorkItemClosedService {
    constructor(
        @InjectLogger() private readonly logger: Logger,
        @Optional() @InjectWorkItemClosed() private readonly hook?: WorkItemClosedHook,
    ) {}

    /** Tells the hook the item closed approved or rejected, and by whom; an item that did not close by the decision is not told. */
    async tell(ctx: WorkContext, item: WorkItem, by: Decider): Promise<void> {
        if (item.status !== "done" && item.status !== "rejected") return
        const outcome = item.status === "done" ? "approved" : "rejected"
        try {
            await this.hook?.closed(ctx.workspaceId, item.id, outcome, by.memberId ?? by.name)
        } catch (cause) {
            this.logger.error(WorkEngineLogEvent.ClosedHookFailed, cause, { workItemId: item.id })
        }
    }
}
