import { Injectable } from "@nestjs/common"
import { LessThan, LessThanOrEqual, MoreThanOrEqual } from "typeorm"
import type { EntityManager } from "typeorm"
import { WorkspaceMembersService, isManagerRole } from "@modules/domain/workspace-members"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { InventoryLogEvent } from "./inventory.log-events"
import type { InventoryWorkbenchView } from "./inventory-workbench.contracts"
import {
    InventoryLocationEntity,
    InventoryMovementEntity,
    InventoryPoLineEntity,
    InventoryPurchaseOrderEntity,
    InventoryRecipeEntity,
    InventoryRecipeLineEntity,
    InventoryStockLevelEntity,
    InventorySupplierEntity,
    InventoryItemEntity,
} from "./persistence/entities"
import type { WorkbenchPoInput, WorkbenchWorkInput } from "./policies/inventory-workbench.inputs"
import {
    itemRowOf,
    levelInputOf,
    movementInputOf,
    poLineInputOf,
    recipeInputOf,
    recipeLineInputOf,
    supplierInputOf,
} from "./policies/inventory-row.mapper"
import { buildInventoryWorkbench } from "./policies/inventory-workbench.policy"
import { WorkItemEntity } from "@modules/domain/work-items"

/** The most locations, suppliers, recipes, orders, lines, movements and items the workbench reads of each kind. */
const LOCATION_LIMIT = 100
const SUPPLIER_LIMIT = 500
const ITEM_LIMIT = 2000
const LEVEL_LIMIT = 10_000
const RECIPE_LIMIT = 500
const RECIPE_LINE_LIMIT = 10_000
const PO_LIMIT = 200
const PO_LINE_LIMIT = 3000
const MOVEMENT_LIMIT = 200
const WORK_LIMIT = 100
const STOCK_OUT_LIMIT = 5000

/** How far back the stock-out history looks. */
const STOCK_OUT_DAYS = 7
const DAY_MS = 86_400_000

@Injectable()
/** Reads the whole inventory workbench of a workspace. */
export class InventoryWorkbenchService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
        private readonly members: WorkspaceMembersService,
    ) {}

    /** The workbench of the caller's workspace; a member reads it, a manager sees `canManage`. */
    async workbench(userId: string, workspaceId: string): Promise<InventoryWorkbenchView> {
        const member = await this.members.require(userId, workspaceId)
        const now = this.clock.now()
        const since = new Date(now.getTime() - STOCK_OUT_DAYS * DAY_MS)
        const [[locations, suppliers, items, levels, recipes, recipeLines], [pos, poLines, movements, work, drops]] =
            await Promise.all([this.readCatalogue(workspaceId), this.readActivity(workspaceId, since)])
        return buildInventoryWorkbench(
            {
                locations,
                suppliers: suppliers.map(supplierInputOf),
                items: items.map(itemRowOf),
                levels: levels.map(levelInputOf),
                recipes: recipes.map(recipeInputOf),
                recipeLines: recipeLines.map(recipeLineInputOf),
                pos,
                poLines: poLines.map(poLineInputOf),
                movements: movements.map(movementInputOf),
                work,
                stockOutItemIds: drops === null ? null : drops.map((row) => row.itemId),
            },
            {
                canManage: isManagerRole(member.role),
                nowIso: now.toISOString(),
                defaultLocationId: locations[0]?.id ?? null,
            },
        )
    }

    /** The catalogue lists: locations, suppliers, items, stock levels and recipes. */
    private readCatalogue(workspaceId: string) {
        return Promise.all([
            this.entityManager.find(InventoryLocationEntity, {
                select: { id: true, name: true },
                where: { workspaceId },
                order: { isDefault: "DESC", createdAt: "ASC" },
                take: LOCATION_LIMIT,
            }),
            this.entityManager.find(InventorySupplierEntity, {
                where: { workspaceId },
                order: { name: "ASC" },
                take: SUPPLIER_LIMIT,
            }),
            this.entityManager.find(InventoryItemEntity, {
                where: { workspaceId },
                order: { name: "ASC" },
                take: ITEM_LIMIT,
            }),
            this.entityManager.find(InventoryStockLevelEntity, {
                select: { itemId: true, locationId: true, qty: true },
                where: { workspaceId },
                take: LEVEL_LIMIT,
            }),
            this.entityManager.find(InventoryRecipeEntity, {
                select: { id: true, name: true, aliases: true },
                where: { workspaceId, active: true },
                order: { name: "ASC" },
                take: RECIPE_LIMIT,
            }),
            this.entityManager.find(InventoryRecipeLineEntity, {
                select: { recipeId: true, itemId: true, qty: true },
                where: { workspaceId },
                take: RECIPE_LINE_LIMIT,
            }),
        ])
    }

    /** The activity lists: orders, order lines, recent movements, waiting decisions and the stock-out history, which may fail on its own. */
    private readActivity(workspaceId: string, since: Date) {
        return Promise.all([
            this.entityManager
                .createQueryBuilder(InventoryPurchaseOrderEntity, "p")
                .select(
                    "p.id, p.po_no, p.supplier_id, p.status, p.total_vnd, p.expected_at, p.message, p.sent_via, p.send_note, p.work_item_id, p.reminders, p.source, p.created_at, s.name AS supplier_name, s.channel AS supplier_channel",
                )
                .leftJoin(InventorySupplierEntity, "s", "s.id = p.supplier_id")
                .where("p.workspace_id = :workspaceId", { workspaceId })
                .orderBy("p.created_at", "DESC")
                .limit(PO_LIMIT)
                .getRawMany<WorkbenchPoInput>(),
            this.entityManager.find(InventoryPoLineEntity, {
                select: {
                    id: true,
                    poId: true,
                    itemId: true,
                    qtyOrdered: true,
                    qtyReceived: true,
                    unitCostVnd: true,
                },
                where: { workspaceId },
                take: PO_LINE_LIMIT,
            }),
            this.entityManager.find(InventoryMovementEntity, {
                select: {
                    id: true,
                    itemId: true,
                    kind: true,
                    qty: true,
                    qtyAfter: true,
                    reason: true,
                    refLabel: true,
                    byName: true,
                    evidence: true,
                    createdAt: true,
                },
                where: { workspaceId },
                order: { createdAt: "DESC" },
                take: MOVEMENT_LIMIT,
            }),
            this.entityManager
                .createQueryBuilder(WorkItemEntity, "w")
                .select("w.id", "id")
                .addSelect("w.action", "action")
                .addSelect("w.proposal", "proposal")
                .addSelect("w.created_at", "created_at")
                .where(
                    "w.workspace_id = :workspaceId AND w.department = 'inventory' AND w.status = 'waiting_decision'",
                    {
                        workspaceId,
                    },
                )
                .orderBy("w.created_at")
                .limit(WORK_LIMIT)
                .getRawMany<WorkbenchWorkInput>(),
            this.entityManager
                .find(InventoryMovementEntity, {
                    select: { itemId: true },
                    where: {
                        workspaceId,
                        qty: LessThan("0"),
                        qtyAfter: LessThanOrEqual("0"),
                        createdAt: MoreThanOrEqual(since),
                    },
                    take: STOCK_OUT_LIMIT,
                })
                .catch((cause: unknown) => {
                    this.logger.error(InventoryLogEvent.StockOutsReadFailed, cause, { workspaceId })
                    return null
                }),
        ])
    }
}
