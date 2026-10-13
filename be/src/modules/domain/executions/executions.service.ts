import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import type {
    ExecutionListFilter,
    ExecutionSettlement,
    NewExecution,
    OptionalExecution,
    OptionalExecutionRecord,
} from "./executions.contracts"
import { ExecutionsError, ExecutionsErrorCode } from "./errors/executions.error"
import type { ExecutionIdRow, ExecutionRecordRow, ExecutionRow } from "./persistence/executions.rows"
import {
    FIND_EXECUTION,
    FIND_EXECUTION_RECORD,
    INSERT_EXECUTION,
    LIST_EXECUTIONS,
    SETTLE_EXECUTION,
} from "./persistence/executions.sql"

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

    /** Reads the complete card through the row owner, inside the caller's transaction when supplied. */
    async findRecord(
        workspaceId: string,
        executionId: string,
        manager: EntityManager = this.entityManager,
    ): Promise<OptionalExecutionRecord> {
        const rows = await manager.query<Array<ExecutionRecordRow>>(FIND_EXECUTION_RECORD, [workspaceId, executionId])
        return rows[0] ?? null
    }

    /** Lists the workspace's approval cards, oldest first, with a caller-provided row limit. */
    list(workspaceId: string, filter: ExecutionListFilter): Promise<Array<ExecutionRecordRow>> {
        return this.entityManager.query<Array<ExecutionRecordRow>>(LIST_EXECUTIONS, [
            workspaceId,
            filter.responsibilityIds ?? null,
            filter.pendingLegacy ?? false,
            filter.limit,
        ])
    }

    /** Settles a card that still waits; answers null when somebody decided it first, so a double click settles once. */
    async settle(
        settlement: ExecutionSettlement,
        manager: EntityManager = this.entityManager,
    ): Promise<OptionalExecution> {
        const rows = await manager.query<Array<ExecutionRow>>(SETTLE_EXECUTION, [
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
