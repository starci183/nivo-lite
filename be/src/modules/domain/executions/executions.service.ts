import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import type { ExecutionSettlement, NewExecution, OptionalExecution } from "./executions.contracts"
import { ExecutionsError, ExecutionsErrorCode } from "./errors/executions.error"
import type { ExecutionIdRow, ExecutionRow } from "./persistence/executions.rows"
import { FIND_EXECUTION, INSERT_EXECUTION, SETTLE_EXECUTION } from "./persistence/executions.sql"

@Injectable()
/** The approval cards of drafts: the only writer of public.executions. */
export class ExecutionsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** Creates the approval card of a draft and answers its id. */
    async open(card: NewExecution): Promise<string> {
        const row = (
            await this.entityManager.query<Array<ExecutionIdRow>>(INSERT_EXECUTION, [
                card.workspaceId,
                card.responsibilityId,
                card.agentId,
                card.draft,
                card.workItemId,
            ])
        )[0]
        if (row === undefined) throw new ExecutionsError({ code: ExecutionsErrorCode.NotCreated })
        return row.id
    }

    /** The approval card of the workspace, or null when there is none with that id. */
    async find(workspaceId: string, executionId: string): Promise<OptionalExecution> {
        const rows = await this.entityManager.query<Array<ExecutionRow>>(FIND_EXECUTION, [workspaceId, executionId])
        return rows[0] ?? null
    }

    /** Settles a card that still waits; answers null when somebody decided it first, so a double click settles once. */
    async settle(settlement: ExecutionSettlement): Promise<OptionalExecution> {
        const rows = await this.entityManager.query<Array<ExecutionRow>>(SETTLE_EXECUTION, [
            settlement.workspaceId,
            settlement.executionId,
            settlement.decision,
            settlement.decidedBy,
            settlement.editedDraft,
            this.clock.now().toISOString(),
        ])
        return rows[0] ?? null
    }
}
