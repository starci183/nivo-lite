import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { DecisionsError, DecisionsErrorCode } from "@modules/domain/decisions"
import { OrdersService } from "@modules/domain/orders"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectPrimaryEntityManager, callDbFunction } from "@modules/platform/database"
import type { SalesAction } from "./sales.contracts"
import type { SalesActionRow } from "./persistence/sales.rows"

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
        private readonly orders: OrdersService,
    ) {}

    /**
     * The current status of an action that belongs to this workspace. A shipment is recorded and announced in one transaction, so its
     * id is the order's: a shipped order of the workspace answers as succeeded.
     */
    async status(principalId: string, workspaceId: string, id: string): Promise<SalesAction> {
        await this.members.require(principalId, workspaceId)
        const rows = await callDbFunction<SalesActionRow>(this.entityManager, "public.sales_action_find", [
            workspaceId,
            null,
            id,
        ])
        const row = rows[0]
        if (row !== undefined) return actionOf(row)
        const order = await this.orders.find(workspaceId, id)
        if (order?.shipped_at == null) throw new DecisionsError({ code: DecisionsErrorCode.NotFound })
        return { id, status: "succeeded", workItemId: null, errorCode: null }
    }

    /** Resolves an enqueue's stable outbox id inside its transaction. */
    async queued(tx: EntityManager, workspaceId: string, dedupeKey: string): Promise<SalesAction> {
        const rows = await callDbFunction<SalesActionRow>(tx, "public.sales_action_find", [
            workspaceId,
            dedupeKey,
            null,
        ])
        const row = rows[0]
        if (row === undefined) throw new DecisionsError({ code: DecisionsErrorCode.NotFound })
        return actionOf(row)
    }
}
