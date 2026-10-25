import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { DecisionsError, DecisionsErrorCode } from "@modules/domain/decisions"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { SalesAction } from "./sales.contracts"
import type { SalesActionRow } from "./persistence/sales.rows"
import { FIND_ACTION_BY_KEY, FIND_ACTION_STATUS } from "./persistence/sales.sql"

const actionOf = (row: SalesActionRow): SalesAction => {
    const failed =
        row.state === "failed" ||
        !row.target_found ||
        (row.state === "done" && (row.work_status === "failed" || row.work_status === "queued"))
    let status = row.state
    if (row.state === "done") status = "succeeded"
    if (failed) status = "failed"
    return {
        id: row.id,
        status,
        workItemId: row.work_item_id,
        errorCode: failed ? DecisionsErrorCode.WorkFailed : null,
    }
}

@Injectable()
/** Reads the persisted job lifecycle, with workspace membership enforced. */
export class SalesStatusService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly members: WorkspaceMembersService,
    ) {}

    /** The current status of an action that belongs to this workspace. */
    async status(principalId: string, workspaceId: string, id: string): Promise<SalesAction> {
        await this.members.require(principalId, workspaceId)
        const rows = await this.entityManager.query<Array<SalesActionRow>>(FIND_ACTION_STATUS, [workspaceId, id])
        const row = rows[0]
        if (row === undefined) throw new DecisionsError({ code: DecisionsErrorCode.NotFound })
        return actionOf(row)
    }

    /** Resolves an enqueue's stable outbox id inside its transaction. */
    async queued(tx: EntityManager, workspaceId: string, dedupeKey: string): Promise<SalesAction> {
        const rows = await tx.query<Array<SalesActionRow>>(FIND_ACTION_BY_KEY, [workspaceId, dedupeKey])
        const row = rows[0]
        if (row === undefined) throw new DecisionsError({ code: DecisionsErrorCode.NotFound })
        return actionOf(row)
    }
}
