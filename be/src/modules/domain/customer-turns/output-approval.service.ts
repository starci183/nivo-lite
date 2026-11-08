import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AgentRunsService } from "@modules/domain/agent-runs"
import { DurableWorkService, WorkEngineService, type WorkContext, type WorkItem } from "@modules/domain/decisions"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { OutputApprovalRequest, OutputApprovalWait } from "./output-approval.contracts"
import { approvalSpecOf } from "./output-steps.policy"

/** How long a held call waits for a person before the graph's timeout applies. */
const APPROVAL_WAIT_MS = 3 * 86_400_000

@Injectable()
/** Opens a held output and its durable wait together; the policy gate exposes the approval only after both commit. */
export class OutputApprovalService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        private readonly durable: DurableWorkService,
        private readonly engine: WorkEngineService,
        private readonly runs: AgentRunsService,
    ) {}

    /** Reuses the original work and wait on replay; a registration failure rolls the item back before any decision can see it. */
    async ask(ctx: WorkContext, request: OutputApprovalRequest): Promise<WorkItem> {
        const { spec, wait } = request
        if (wait === null) return this.engine.runWork(ctx, spec)
        const item = await this.entityManager.transaction(async (manager) => {
            const queued = await this.durable.enqueueWork(ctx, spec, manager)
            await this.register(manager, queued, wait)
            return queued
        })
        return (await this.engine.runQueuedItem(ctx, item.id)) ?? item
    }

    private register(manager: EntityManager, item: WorkItem, wait: OutputApprovalWait): Promise<void> {
        const deadlineAt = new Date(this.clock.now().getTime() + APPROVAL_WAIT_MS)
        const input = {
            workItemId: item.id,
            deadlineAt: deadlineAt.toISOString(),
            calls: [...wait.calls],
            scope: wait.scope,
        }
        return this.runs.waitOn(manager, {
            workspaceId: item.workspace_id,
            wakeId: wait.wakeId,
            spec: approvalSpecOf(input),
            workItemId: item.id,
            deadlineAt,
        })
    }
}
