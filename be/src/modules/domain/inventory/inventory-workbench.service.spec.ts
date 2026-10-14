import { Test } from "@nestjs/testing"
import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { InventoryLogEvent } from "./inventory.log-events"
import { InventoryWorkbenchService } from "./inventory-workbench.service"
import type { WorkbenchItemRow } from "./persistence/inventory-workbench.rows"
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

const NOW = "2026-10-13T10:00:00.000Z"
const MEMBER = { userId: "u-1", workspaceId: "ws-1", staffId: null, displayName: "Lan", status: "active" as const }

const item = (id: string): WorkbenchItemRow => ({
    id,
    sku: id,
    name: id,
    unit: "piece",
    units: [],
    category: "",
    cost_vnd: 0,
    sell_price_vnd: null,
    reorder_point: 0,
    reorder_qty: 0,
    supplier_id: null,
    aliases: [],
    active: true,
})

const workbenchReads = (
    stockOuts: unknown,
    items: ReadonlyArray<WorkbenchItemRow> = [],
): ReadonlyArray<readonly [string, unknown]> => [
    [SELECT_WORKBENCH_LOCATIONS, [{ id: "loc-1", name: "Kho" }]],
    [SELECT_WORKBENCH_SUPPLIERS, []],
    [SELECT_WORKBENCH_ITEMS, items],
    [SELECT_WORKBENCH_LEVELS, []],
    [SELECT_WORKBENCH_RECIPES, []],
    [SELECT_WORKBENCH_RECIPE_LINES, []],
    [SELECT_WORKBENCH_POS, []],
    [SELECT_WORKBENCH_PO_LINES, []],
    [SELECT_WORKBENCH_MOVEMENTS, []],
    [SELECT_WORKBENCH_WORK, []],
    [SELECT_WORKBENCH_STOCK_OUTS, stockOuts],
]

const build = async (entityManager: MockEntityManager, role: "owner" | "staff") => {
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue({ ...MEMBER, role })
    const clock = new FakeClock(NOW)
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            InventoryWorkbenchService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: CLOCK, useValue: clock },
            { provide: LOGGER, useValue: logger },
            { provide: WorkspaceMembersService, useValue: members },
        ],
    }).compile()
    return { service: moduleRef.get(InventoryWorkbenchService), members, logger }
}

describe("InventoryWorkbenchService", () => {
    it("reads the workbench of a manager with the stock-outs of the last seven days", async () => {
        const em = mockEntityManager({
            query: workbenchReads([{ item_id: "i-1" }, { item_id: "i-2" }], [item("i-1"), item("i-2")]),
        })
        const { service, members } = await build(em, "owner")

        const view = await service.workbench("u-1", "ws-1")

        expect(members.require).toHaveBeenCalledWith("u-1", "ws-1")
        expect(view).toMatchObject({ canManage: true, defaultLocationId: "loc-1", stockOuts7d: 2, nowIso: NOW })
        expect(em.query).toHaveBeenCalledWith(SELECT_WORKBENCH_STOCK_OUTS, ["ws-1", "2026-10-06T10:00:00.000Z"])
    })

    it("answers a member who cannot manage, and no stock-out figure when that history cannot be read", async () => {
        const failure = new Error("stock outs unavailable")
        const em = mockEntityManager({ query: workbenchReads([]) })
        em.query.mockImplementation((text: string) =>
            text === SELECT_WORKBENCH_STOCK_OUTS ? Promise.reject(failure) : Promise.resolve([]),
        )
        const { service, logger } = await build(em, "staff")

        const view = await service.workbench("u-1", "ws-1")

        expect(view).toMatchObject({ canManage: false, defaultLocationId: null, stockOuts7d: null })
        expect(logger.error).toHaveBeenCalledWith(InventoryLogEvent.StockOutsReadFailed, failure, {
            workspaceId: "ws-1",
        })
    })
})
