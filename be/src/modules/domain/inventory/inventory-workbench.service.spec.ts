import { Test } from "@nestjs/testing"
import { LessThan, LessThanOrEqual, MoreThanOrEqual } from "typeorm"
import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { inventoryItemOf, inventoryLocationOf, inventoryMovementOf } from "@tests/fixtures/builders/inventory.builder"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { WorkItemEntity } from "@modules/domain/work-items"
import { InventoryLogEvent } from "./inventory.log-events"
import { InventoryWorkbenchService } from "./inventory-workbench.service"
import {
    InventoryItemEntity,
    InventoryLocationEntity,
    InventoryMovementEntity,
    InventoryPoLineEntity,
    InventoryRecipeEntity,
    InventoryRecipeLineEntity,
    InventoryStockLevelEntity,
    InventorySupplierEntity,
} from "./persistence/entities"

const NOW = "2026-10-13T10:00:00.000Z"
const MEMBER = { userId: "u-1", workspaceId: "ws-1", staffId: null, displayName: "Lan", status: "active" as const }

const item = (id: string): InventoryItemEntity =>
    inventoryItemOf({ id, sku: id, name: id, unit: "piece", costVnd: "0" })

/** The reads of one workbench: a stub for every entity the workbench lists, and the two table-name reads (orders, work). */
const workbenchReads = (
    stockOuts: ReadonlyArray<InventoryMovementEntity>,
    items: ReadonlyArray<InventoryItemEntity> = [],
) => {
    const em = mockEntityManager({
        find: [
            [InventoryLocationEntity, [inventoryLocationOf({ id: "loc-1", name: "Kho" })]],
            [InventorySupplierEntity, []],
            [InventoryItemEntity, items],
            [InventoryStockLevelEntity, []],
            [InventoryRecipeEntity, []],
            [InventoryRecipeLineEntity, []],
            [InventoryPoLineEntity, []],
            [InventoryMovementEntity, []],
            [InventoryMovementEntity, stockOuts],
        ],
    })
    const [orders, work] = queueQueryBuilders(em, [{ getRawMany: [] }, { getRawMany: [] }])
    return { em, orders, work }
}

const movementRow = (
    overrides: { [K in keyof InventoryMovementEntity]?: InventoryMovementEntity[K] } = {},
): InventoryMovementEntity => inventoryMovementOf(overrides)

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
        const { em, orders, work } = workbenchReads(
            [movementRow({ itemId: "i-1" }), movementRow({ itemId: "i-2" })],
            [item("i-1"), item("i-2")],
        )
        const { service, members } = await build(em, "owner")

        const view = await service.workbench("u-1", "ws-1")

        expect(members.require).toHaveBeenCalledWith("u-1", "ws-1")
        expect(view).toMatchObject({ canManage: true, defaultLocationId: "loc-1", stockOuts7d: 2, nowIso: NOW })
        expect(em.find).toHaveBeenCalledWith(InventoryMovementEntity, {
            select: { itemId: true },
            where: {
                workspaceId: "ws-1",
                qty: LessThan("0"),
                qtyAfter: LessThanOrEqual("0"),
                createdAt: MoreThanOrEqual(new Date("2026-10-06T10:00:00.000Z")),
            },
            take: 5000,
        })
        expect(orders?.callsOf("where")).toEqual([["p.workspace_id = :workspaceId", { workspaceId: "ws-1" }]])
        expect(orders?.callsOf("limit")).toEqual([[200]])
        expect(em.createQueryBuilder).toHaveBeenCalledWith(WorkItemEntity, "w")
        expect(work?.callsOf("limit")).toEqual([[100]])
    })

    it("answers a member who cannot manage, and no stock-out figure when that history cannot be read", async () => {
        const failure = new Error("stock outs unavailable")
        const { em } = workbenchReads([])
        em.find.mockImplementation((_entity, options) =>
            options?.take === 5000 ? Promise.reject(failure) : Promise.resolve([]),
        )
        const { service, logger } = await build(em, "staff")

        const view = await service.workbench("u-1", "ws-1")

        expect(view).toMatchObject({ canManage: false, defaultLocationId: null, stockOuts7d: null })
        expect(logger.error).toHaveBeenCalledWith(InventoryLogEvent.StockOutsReadFailed, failure, {
            workspaceId: "ws-1",
        })
    })
})
