import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InventoryReplenishQueue } from "@modules/queues/inventory-replenish"
import { InventoryError, InventoryErrorCode } from "./errors/inventory.error"
import type { AppliedMovement, MovementParams } from "./inventory.contracts"
import { InventoryLocationsService } from "./inventory-locations.service"
import { columnNumber } from "./policies/number-format.policy"
import { APPLY_MOVEMENT, SELECT_ALL_TOTALS, SELECT_LEVEL_QTY, SELECT_TOTALS } from "./persistence/inventory.sql"

/** The author of a movement nobody typed: the system. */
export const SYSTEM_ACTOR = "NIVO"

interface MovementResult {
    readonly applied: boolean
    readonly before?: number | string
    readonly after?: number | string
    readonly cost?: number | string
}

interface MovementResultRow {
    readonly result: MovementResult | null
}

interface TotalRow {
    readonly item_id: string
    readonly qty: number | string
}

interface LevelRow {
    readonly qty: number | string
}

@Injectable()
/** The one way a quantity changes: signed movements through the database function, plus stock totals and the low-stock follow-up. */
export class InventoryMovementsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly locations: InventoryLocationsService,
        private readonly replenishment: InventoryReplenishQueue,
    ) {}

    /** Applies one movement (row-locked and idempotent by its dedupe key) at its location, the default one when none is named. */
    async apply(workspaceId: string, movement: MovementParams): Promise<AppliedMovement> {
        const locationId = movement.locationId ?? (await this.locations.defaultLocation(workspaceId))
        const [row] = await this.entityManager.query<Array<MovementResultRow>>(APPLY_MOVEMENT, [
            workspaceId,
            movement.itemId,
            locationId,
            movement.kind,
            movement.delta,
            movement.reason,
            movement.refType ?? "manual",
            movement.refId ?? null,
            movement.refLabel ?? null,
            movement.by ?? SYSTEM_ACTOR,
            movement.evidence ?? null,
            movement.dedupe ?? null,
            movement.unitCost ?? null,
        ])
        const result = row?.result
        if (result === null || result === undefined) {
            throw new InventoryError({ code: InventoryErrorCode.MovementNotApplied })
        }
        return {
            applied: result.applied,
            before: columnNumber(result.before),
            after: columnNumber(result.after),
            cost: columnNumber(result.cost),
        }
    }

    /** The quantity of one item at one location. */
    async levelAt(itemId: string, locationId: string): Promise<number> {
        const [row] = await this.entityManager.query<Array<LevelRow>>(SELECT_LEVEL_QTY, [itemId, locationId])
        return columnNumber(row?.qty)
    }

    /** The total stock of each item across all locations; the named items only, or every item when none are named. */
    async totals(workspaceId: string, itemIds?: ReadonlyArray<string>): Promise<Map<string, number>> {
        const rows =
            itemIds === undefined
                ? await this.entityManager.query<Array<TotalRow>>(SELECT_ALL_TOTALS, [workspaceId])
                : await this.entityManager.query<Array<TotalRow>>(SELECT_TOTALS, [workspaceId, [...itemIds]])
        return new Map(rows.map((row) => [row.item_id, columnNumber(row.qty)]))
    }

    /** Schedules the low-stock check of the moved items; nothing is queued for an empty list. */
    async replenishLater(workspaceId: string, itemIds: ReadonlyArray<string>): Promise<void> {
        if (itemIds.length === 0) return
        await this.entityManager.transaction((tx) => this.replenishment.enqueueReplenish({ workspaceId, itemIds }, tx))
    }
}
