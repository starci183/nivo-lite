import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { AgentRunsService } from "./agent-runs.service"
import type { AgentRunItemVerdicts } from "./agent-runs-engine.contracts"
import { InjectAgentRunItemVerdicts } from "./agent-runs.decorators"

@Injectable()
/**
 * Finishes the wait step of a work item right after the item closed by a decision, in a transaction of its own. The closed item is the record
 * of the decision, so this call is at least once: if it never happens the sweep reads the item and finishes the wait with the same verdict.
 */
export class AgentRunItemClosedService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly runs: AgentRunsService,
        @InjectAgentRunItemVerdicts() private readonly verdicts: AgentRunItemVerdicts,
    ) {}

    /** Finishes the step that waits on the item with the verdict; a second call finds no waiting step and does nothing. */
    async closed(
        workspaceId: string,
        workItemId: string,
        _outcome: "approved" | "rejected",
        _by: string,
    ): Promise<void> {
        const decision = (await this.verdicts.verdictsOf([workItemId])).get(workItemId)
        if (decision === undefined) return
        await this.entityManager.transaction((tx) => this.runs.resumeWaiting(workspaceId, tx, workItemId, decision))
    }
}
