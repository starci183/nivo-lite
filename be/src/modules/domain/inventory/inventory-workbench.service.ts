import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { WorkspaceMembersService, isManagerRole } from "@modules/domain/workspace-members"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { InventoryLogEvent } from "./inventory.log-events"
import { INVENTORY_TEMPLATES } from "./inventory-templates"
import type { InventoryTemplateInfo, InventoryWorkbenchView } from "./inventory-workbench.contracts"
import {
    SELECT_WORKBENCH_ITEMS,
    SELECT_WORKBENCH_LEVELS,
    SELECT_WORKBENCH_LOCATIONS,
    SELECT_WORKBENCH_MOVEMENTS,
    SELECT_WORKBENCH_PO_LINES,
    SELECT_WORKBENCH_POS,
    SELECT_WORKBENCH_RECIPES,
    SELECT_WORKBENCH_RECIPE_LINES,
    SELECT_WORKBENCH_STOCK_OUTS,
    SELECT_WORKBENCH_SUPPLIERS,
    SELECT_WORKBENCH_WORK,
} from "./persistence/inventory-workbench.sql"
import type {
    WorkbenchItemRow,
    WorkbenchLevelRow,
    WorkbenchLocationRow,
    WorkbenchMovementRow,
    WorkbenchPoLineRow,
    WorkbenchPoRow,
    WorkbenchRecipeLineRow,
    WorkbenchRecipeRow,
    WorkbenchStockOutRow,
    WorkbenchSupplierRow,
    WorkbenchWorkRow,
} from "./persistence/inventory-workbench.rows"
import { buildInventoryWorkbench } from "./policies/inventory-workbench.policy"

/** How far back the stock-out history looks. */
const STOCK_OUT_DAYS = 7
const DAY_MS = 86_400_000

@Injectable()
/** Reads the whole inventory workbench of a workspace and the starter sets a new shop can pick. */
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
        const since = new Date(now.getTime() - STOCK_OUT_DAYS * DAY_MS).toISOString()
        const [locations, suppliers, items, levels, recipes, recipeLines, pos, poLines, movements, work, drops] =
            await Promise.all([
                this.entityManager.query<Array<WorkbenchLocationRow>>(SELECT_WORKBENCH_LOCATIONS, [workspaceId]),
                this.entityManager.query<Array<WorkbenchSupplierRow>>(SELECT_WORKBENCH_SUPPLIERS, [workspaceId]),
                this.entityManager.query<Array<WorkbenchItemRow>>(SELECT_WORKBENCH_ITEMS, [workspaceId]),
                this.entityManager.query<Array<WorkbenchLevelRow>>(SELECT_WORKBENCH_LEVELS, [workspaceId]),
                this.entityManager.query<Array<WorkbenchRecipeRow>>(SELECT_WORKBENCH_RECIPES, [workspaceId]),
                this.entityManager.query<Array<WorkbenchRecipeLineRow>>(SELECT_WORKBENCH_RECIPE_LINES, [workspaceId]),
                this.entityManager.query<Array<WorkbenchPoRow>>(SELECT_WORKBENCH_POS, [workspaceId]),
                this.entityManager.query<Array<WorkbenchPoLineRow>>(SELECT_WORKBENCH_PO_LINES, [workspaceId]),
                this.entityManager.query<Array<WorkbenchMovementRow>>(SELECT_WORKBENCH_MOVEMENTS, [workspaceId]),
                this.entityManager.query<Array<WorkbenchWorkRow>>(SELECT_WORKBENCH_WORK, [workspaceId]),
                this.entityManager
                    .query<Array<WorkbenchStockOutRow>>(SELECT_WORKBENCH_STOCK_OUTS, [workspaceId, since])
                    .catch((cause: unknown) => {
                        this.logger.error(InventoryLogEvent.StockOutsReadFailed, cause, { workspaceId })
                        return null
                    }),
            ])
        return buildInventoryWorkbench(
            {
                locations,
                suppliers,
                items,
                levels,
                recipes,
                recipeLines,
                pos,
                poLines,
                movements,
                work,
                stockOutItemIds: drops === null ? null : drops.map((row) => row.item_id),
            },
            {
                canManage: isManagerRole(member.role),
                nowIso: now.toISOString(),
                defaultLocationId: locations[0]?.id ?? null,
            },
        )
    }

    /** The starter sets a new shop can pick. */
    templates(): ReadonlyArray<InventoryTemplateInfo> {
        return INVENTORY_TEMPLATES
    }
}
