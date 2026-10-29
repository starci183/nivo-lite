import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { inventoryStockLevelOf } from "@tests/fixtures/builders/inventory.builder"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { InventoryReplenishQueue } from "@modules/queues/inventory-replenish"
import { InventoryErrorCode } from "./errors/inventory.error"
import { InventoryLocationsService } from "./inventory-locations.service"
import { InventoryMovementsService } from "./inventory-movements.service"
import { InventoryStockLevelEntity } from "./persistence/entities"
import { APPLY_MOVEMENT } from "@tests/fixtures/builders/inventory-calls.builder"

const build = async (entityManager: MockEntityManager) => {
    const locations = mock<InventoryLocationsService>()
    locations.defaultLocation.mockResolvedValue("loc-default")
    const queue = mock<InventoryReplenishQueue>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            InventoryMovementsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: InventoryLocationsService, useValue: locations },
            { provide: InventoryReplenishQueue, useValue: queue },
        ],
    }).compile()
    return { movements: moduleRef.get(InventoryMovementsService), locations, queue }
}

describe("InventoryMovementsService / apply", () => {
    it("applies a movement at the default location with the defaults of the optional fields", async () => {
        const em = mockEntityManager({
            query: [
                APPLY_MOVEMENT,
                [{ inventory_apply_movement: { applied: true, before: "2.000", after: "5.500", cost: "1200.50" } }],
            ],
        })
        const { movements, locations } = await build(em)

        await expect(
            movements.apply("ws-1", { itemId: "item-1", kind: "in", delta: 3.5, reason: "Delivery" }),
        ).resolves.toEqual({
            applied: true,
            before: 2,
            after: 5.5,
            cost: 1200.5,
        })

        expect(locations.defaultLocation).toHaveBeenCalledWith("ws-1")
        expect(em.query).toHaveBeenCalledWith(APPLY_MOVEMENT, [
            "ws-1",
            "item-1",
            "loc-default",
            "in",
            3.5,
            "Delivery",
            "manual",
            null,
            null,
            "NIVO",
            null,
            null,
            null,
        ])
    })

    it("passes every field of the movement and skips the default location when one is named", async () => {
        const em = mockEntityManager({ query: [APPLY_MOVEMENT, [{ inventory_apply_movement: { applied: false } }]] })
        const { movements, locations } = await build(em)

        const answer = await movements.apply("ws-1", {
            itemId: "item-1",
            locationId: "loc-2",
            kind: "out",
            delta: -1,
            reason: "Sale",
            refType: "order",
            refId: "order-1",
            refLabel: "DH-1",
            by: "Lan",
            evidence: "2 tea",
            dedupe: "order:1:item-1",
            unitCost: 9,
        })

        expect(answer).toEqual({ applied: false, before: 0, after: 0, cost: 0 })
        expect(locations.defaultLocation).not.toHaveBeenCalled()
        expect(em.query).toHaveBeenCalledWith(APPLY_MOVEMENT, [
            "ws-1",
            "item-1",
            "loc-2",
            "out",
            -1,
            "Sale",
            "order",
            "order-1",
            "DH-1",
            "Lan",
            "2 tea",
            "order:1:item-1",
            9,
        ])
    })
})

describe("InventoryMovementsService / apply", () => {
    it("refuses when the database function answers nothing", async () => {
        const em = mockEntityManager({ query: [APPLY_MOVEMENT, [{ inventory_apply_movement: null }]] })
        const { movements } = await build(em)

        await expect(
            movements.apply("ws-1", { itemId: "item-1", kind: "in", delta: 1, reason: "x" }),
        ).rejects.toMatchObject({
            code: InventoryErrorCode.MovementNotApplied,
        })
    })

    it("refuses when the database answers no row", async () => {
        const em = mockEntityManager({ query: [APPLY_MOVEMENT, []] })
        const { movements } = await build(em)

        await expect(
            movements.apply("ws-1", { itemId: "item-1", kind: "in", delta: 1, reason: "x" }),
        ).rejects.toMatchObject({
            code: InventoryErrorCode.MovementNotApplied,
        })
    })
})

describe("InventoryMovementsService / levelAt", () => {
    it("reads the quantity of an item at a location", async () => {
        const em = mockEntityManager({ findOne: [InventoryStockLevelEntity, inventoryStockLevelOf({ qty: "7.250" })] })
        const { movements } = await build(em)

        await expect(movements.levelAt("item-1", "loc-1")).resolves.toBe(7.25)
        expect(em.findOne).toHaveBeenCalledWith(InventoryStockLevelEntity, {
            select: { qty: true },
            where: { itemId: "item-1", locationId: "loc-1" },
        })
    })

    it("reads a missing level as zero", async () => {
        const em = mockEntityManager({ findOne: [InventoryStockLevelEntity, null] })
        const { movements } = await build(em)

        await expect(movements.levelAt("item-1", "loc-1")).resolves.toBe(0)
    })
})

describe("InventoryMovementsService / totals", () => {
    it("sums the named items", async () => {
        const em = mockEntityManager()
        const [sums] = queueQueryBuilders(em, [{ getRawMany: [{ item_id: "item-1", qty: "3.000" }] }])
        const { movements } = await build(em)

        await expect(movements.totals("ws-1", ["item-1"])).resolves.toEqual(new Map([["item-1", 3]]))
        expect(sums?.callsOf("andWhere")).toEqual([
            ["level.item_id = ANY(CAST(:itemIds AS uuid[]))", { itemIds: ["item-1"] }],
        ])
        expect(sums?.callsOf("limit")).toEqual([[5000]])
    })

    it("sums every item when none are named", async () => {
        const em = mockEntityManager()
        const [sums] = queueQueryBuilders(em, [
            {
                getRawMany: [
                    { item_id: "item-1", qty: "3" },
                    { item_id: "item-2", qty: "0" },
                ],
            },
        ])
        const { movements } = await build(em)

        await expect(movements.totals("ws-1")).resolves.toEqual(
            new Map([
                ["item-1", 3],
                ["item-2", 0],
            ]),
        )
        expect(sums?.callsOf("andWhere")).toEqual([])
    })
})

describe("InventoryMovementsService / replenishLater", () => {
    it("queues the low-stock check of the moved items in one transaction", async () => {
        const tx = fakeTransaction(mockEntityManager())
        const { movements, queue } = await build(tx.em)

        await movements.replenishLater("ws-1", ["item-1", "item-2"])

        expect(queue.enqueueReplenish).toHaveBeenCalledWith(
            { workspaceId: "ws-1", itemIds: ["item-1", "item-2"] },
            expect.anything(),
        )
        expect(tx.commits).toBe(1)
    })

    it("queues nothing for an empty list", async () => {
        const tx = fakeTransaction(mockEntityManager())
        const { movements, queue } = await build(tx.em)

        await movements.replenishLater("ws-1", [])

        expect(queue.enqueueReplenish).not.toHaveBeenCalled()
        expect(tx.commits).toBe(0)
    })
})
