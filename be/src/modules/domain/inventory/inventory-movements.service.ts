import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { callDbFunction, InjectPrimaryEntityManager } from "@modules/platform/database"
import { InventoryReplenishQueue } from "@modules/queues/inventory-replenish"
import { InventoryError, InventoryErrorCode } from "./errors/inventory.error"
import type { AppliedMovement, MovementParams } from "./inventory.contracts"
import { InventoryLocationsService } from "./inventory-locations.service"
import { columnNumber } from "./policies/number-format.policy"
import { InventoryStockLevelEntity } from "./persistence/entities"

/** The author of a movement nobody typed: the system. */
export const SYSTEM_ACTOR = "NIVO"

interface MovementResult {
    readonly applied: boolean
    readonly before?: number | string
    readonly after?: number | string
    readonly cost?: number | string
}

interface MovementResultRow {
    readonly inventory_apply_movement: MovementResult | null
}

interface TotalRow {
    readonly item_id: string
    readonly qty: number | string
}

/** The most items one totals read answers. */
const TOTALS_LIMIT = 5000

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
        const [row] = await callDbFunction<MovementResultRow>(this.entityManager, "public.inventory_apply_movement", [
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
        const result = row?.inventory_apply_movement
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
        const level = await this.entityManager.findOne(InventoryStockLevelEntity, {
            select: { qty: true },
            where: { itemId, locationId },
        })
        return columnNumber(level?.qty)
    }

    /** The total stock of each item across all locations; the named items only, or every item when none are named. */
    async totals(workspaceId: string, itemIds?: ReadonlyArray<string>): Promise<Map<string, number>> {
        const query = this.entityManager
            .createQueryBuilder(InventoryStockLevelEntity, "level")
            .select("level.item_id", "item_id")
            .addSelect("SUM(level.qty)", "qty")
            .where("level.workspace_id = :workspaceId", { workspaceId })
            .groupBy("level.item_id")
            .limit(TOTALS_LIMIT)
        if (itemIds !== undefined)
            query.andWhere("level.item_id = ANY(CAST(:itemIds AS uuid[]))", { itemIds: [...itemIds] })
        const rows = await query.getRawMany<TotalRow>()
        return new Map(rows.map((row) => [row.item_id, columnNumber(row.qty)]))
    }

    /** Schedules the low-stock check of the moved items; nothing is queued for an empty list. */
    async replenishLater(workspaceId: string, itemIds: ReadonlyArray<string>): Promise<void> {
        if (itemIds.length === 0) return
        await this.entityManager.transaction((tx) => this.replenishment.enqueueReplenish({ workspaceId, itemIds }, tx))
    }
}
