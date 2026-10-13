import { Test } from "@nestjs/testing"
import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { ApprovalGate, OfficeLog } from "@modules/domain/module-ops"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { InventoryErrorCode } from "./errors/inventory.error"
import { InventoryLocationsService } from "./inventory-locations.service"
import { InventoryMovementsService } from "./inventory-movements.service"
import { InventoryStockService } from "./inventory-stock.service"
import { SELECT_ITEM, SELECT_ITEM_LABEL, SELECT_LOCATION_NAMES } from "./persistence/inventory.sql"

const UUID = "0b8c1f0e-3a49-4b7e-9d3f-2c1f6a5d7e90"

const text = (key: string, params: Record<string, string | number> = {}): string => `${key}${JSON.stringify(params)}`

const itemRow = (overrides: Record<string, unknown> = {}) => ({
    id: "item-1",
    sku: "TEA",
    name: "Tea",
    unit: "kg",
    units: [{ unit: "box", factor: 10 }],
    category: "",
    cost_vnd: "20000.00",
    sell_price_vnd: null,
    reorder_point: "0",
    reorder_qty: "0",
    supplier_id: null,
    aliases: [],
    active: true,
    ...overrides,
})

const build = async (entityManager: MockEntityManager) => {
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key, params) => text(key, params))
    const office = mock<OfficeLog>()
    const gate = mock<ApprovalGate>()
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue({
        userId: "user-1",
        workspaceId: "ws-1",
        role: "staff",
        staffId: null,
        displayName: "Lan",
        status: "active",
    })
    const movements = mock<InventoryMovementsService>()
    movements.levelAt.mockResolvedValue(10)
    movements.apply.mockResolvedValue({ applied: true, before: 10, after: 12, cost: 20000 })
    const locations = mock<InventoryLocationsService>()
    locations.defaultLocation.mockResolvedValue("loc-1")
    const moduleRef = await Test.createTestingModule({
        providers: [
            InventoryStockService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: OfficeLog, useValue: office },
            { provide: ApprovalGate, useValue: gate },
            { provide: CLOCK, useValue: new FakeClock("2026-10-12T08:00:00.000Z") },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: InventoryMovementsService, useValue: movements },
            { provide: InventoryLocationsService, useValue: locations },
        ],
    }).compile()
    return { service: moduleRef.get(InventoryStockService), office, gate, members, movements, locations }
}

describe("InventoryStockService", () => {
    describe("adjustStock", () => {
        it("applies a small change at once, logs it and queues the low-stock check", async () => {
            const em = mockEntityManager({ query: [SELECT_ITEM, [itemRow()]] })
            const { service, movements, office, members } = await build(em)

            const result = await service.adjustStock("user-1", "ws-1", {
                itemId: "item-1",
                locationId: UUID,
                delta: 2,
                reason: "  found  ",
            })

            expect(result).toEqual({ state: "applied", before: 10, after: 12 })
            expect(members.require).toHaveBeenCalledWith("user-1", "ws-1", [])
            expect(movements.apply).toHaveBeenCalledWith("ws-1", {
                itemId: "item-1",
                locationId: UUID,
                kind: "adjust",
                delta: 2,
                reason: "found",
                refType: "manual",
                by: "Lan",
                evidence: null,
            })
            expect(office.logEvidence).toHaveBeenCalledWith(
                "ws-1",
                expect.objectContaining({ kind: "inventory.adjust", actor: "Lan", evidence: null }),
            )
            expect(movements.replenishLater).toHaveBeenCalledWith("ws-1", ["item-1"])
        })

        it("sets the level to a counted quantity and names the default reason when none is typed", async () => {
            const em = mockEntityManager({ query: [SELECT_ITEM, [itemRow({ cost_vnd: "0" })]] })
            const { service, movements, locations } = await build(em)

            await service.adjustStock("user-1", "ws-1", { itemId: "item-1", counted: 13, reason: "" })

            expect(locations.defaultLocation).toHaveBeenCalledWith("ws-1")
            expect(movements.apply).toHaveBeenCalledWith(
                "ws-1",
                expect.objectContaining({ delta: 3, reason: text("inventory.countReason"), locationId: "loc-1" }),
            )
        })

        it("names the manual reason when a change is typed without one", async () => {
            const em = mockEntityManager({ query: [SELECT_ITEM, [itemRow()]] })
            const { service, movements } = await build(em)

            await service.adjustStock("user-1", "ws-1", { itemId: "item-1", delta: 1, reason: "" })

            expect(movements.apply).toHaveBeenCalledWith(
                "ws-1",
                expect.objectContaining({ reason: text("inventory.manualReason") }),
            )
        })

        it("reads an input with neither a change nor a count as no change", async () => {
            const em = mockEntityManager({ query: [SELECT_ITEM, [itemRow()]] })
            const { service, movements } = await build(em)

            await expect(service.adjust("ws-1", "Lan", { itemId: "item-1", reason: "x" })).resolves.toEqual({
                state: "applied",
                before: 10,
                after: 10,
            })

            expect(movements.apply).not.toHaveBeenCalled()
        })

        it("changes nothing when the count equals the level", async () => {
            const em = mockEntityManager({ query: [SELECT_ITEM, [itemRow()]] })
            const { service, movements } = await build(em)

            await expect(
                service.adjustStock("user-1", "ws-1", { itemId: "item-1", counted: 10, reason: "x" }),
            ).resolves.toEqual({ state: "applied", before: 10, after: 10 })

            expect(movements.apply).not.toHaveBeenCalled()
        })

        it("asks the owner for a big change and answers that it waits", async () => {
            const em = mockEntityManager({ query: [SELECT_ITEM, [itemRow()]] })
            const { service, gate, movements } = await build(em)
            gate.request.mockResolvedValue({ status: "waiting_decision", workItemId: "work-1" })

            await expect(
                service.adjustStock("user-1", "ws-1", { itemId: "item-1", delta: -20, reason: "spoiled" }),
            ).resolves.toEqual({ state: "waiting", workItemId: "work-1" })

            expect(gate.request).toHaveBeenCalledWith(
                expect.objectContaining({
                    workspaceId: "ws-1",
                    actor: "Lan",
                    action: "adjust_stock",
                    subjectType: "stock",
                    subjectId: "item-1",
                    dedupeKey: `adjust_stock:item-1:${new Date("2026-10-12T08:00:00.000Z").getTime()}`,
                    amountVnd: 400000,
                    fields: expect.objectContaining({
                        item_id: "item-1",
                        location_id: "loc-1",
                        delta: -20,
                        reason: "spoiled",
                        evidence: "",
                        ref_type: "manual",
                    }),
                }),
            )
            expect(movements.apply).not.toHaveBeenCalled()
        })

        it("words a big change on a free item without a value and answers applied when the gate let it through", async () => {
            const em = mockEntityManager({ query: [SELECT_ITEM, [itemRow({ cost_vnd: "0" })]] })
            const { service, gate, movements } = await build(em)
            gate.request.mockResolvedValue({ status: "done", workItemId: "work-1" })
            movements.levelAt.mockResolvedValueOnce(10).mockResolvedValueOnce(30)

            await expect(
                service.adjustStock("user-1", "ws-1", { itemId: "item-1", delta: 20, reason: "restock" }),
            ).resolves.toEqual({ state: "applied", before: 10, after: 30 })

            expect(gate.request).toHaveBeenCalledWith(
                expect.objectContaining({ summary: expect.stringContaining('"value":""') }),
            )
        })

        it("refuses a call with neither a change nor a count", async () => {
            const { service } = await build(mockEntityManager())

            await expect(
                service.adjustStock("user-1", "ws-1", { itemId: "item-1", reason: "x" }),
            ).rejects.toMatchObject({ code: InventoryErrorCode.AdjustQtyRequired })
        })

        it("refuses an unknown item", async () => {
            const em = mockEntityManager({ query: [SELECT_ITEM, []] })
            const { service } = await build(em)

            await expect(
                service.adjustStock("user-1", "ws-1", { itemId: "item-1", delta: 1, reason: "x" }),
            ).rejects.toMatchObject({ code: InventoryErrorCode.ItemNotFound })
        })
    })

    describe("stockTake", () => {
        it("counts each line and sums what was applied, waits and matched", async () => {
            const em = mockEntityManager({
                query: [
                    [SELECT_ITEM, [itemRow()]],
                    [SELECT_ITEM, [itemRow()]],
                    [SELECT_ITEM, [itemRow()]],
                ],
            })
            const { service, gate, movements } = await build(em)
            movements.levelAt.mockResolvedValueOnce(10).mockResolvedValueOnce(10).mockResolvedValueOnce(10)
            gate.request.mockResolvedValue({ status: "waiting_decision", workItemId: "work-1" })

            const result = await service.stockTake("user-1", "ws-1", {
                counts: [
                    { itemId: "item-1", counted: 11 },
                    { itemId: "item-1", counted: 100 },
                    { itemId: "item-1", counted: 10 },
                    { itemId: "item-1", counted: -1 },
                ],
            })

            expect(result).toEqual({ applied: 1, waiting: 1, same: 1 })
            expect(movements.apply).toHaveBeenCalledWith(
                "ws-1",
                expect.objectContaining({
                    refType: "count",
                    reason: text("inventory.stockTakeReason"),
                    evidence: text("inventory.stockTakeEvidence"),
                }),
            )
        })

        it("refuses a count with no usable line", async () => {
            const { service } = await build(mockEntityManager())

            await expect(
                service.stockTake("user-1", "ws-1", { counts: [{ itemId: "item-1", counted: Number.NaN }] }),
            ).rejects.toMatchObject({ code: InventoryErrorCode.CountEmpty })
        })
    })

    describe("transferStock", () => {
        const request = {
            itemId: "item-1",
            fromLocationId: "loc-1",
            toLocationId: "loc-2",
            qty: 4,
            note: "  for the shop  ",
        }

        it("moves the goods out of one location and into the other under one key", async () => {
            const em = mockEntityManager({
                query: [
                    [SELECT_ITEM_LABEL, [{ name: "Tea", unit: "kg" }]],
                    [
                        SELECT_LOCATION_NAMES,
                        [
                            { id: "loc-1", name: "Main" },
                            { id: "loc-2", name: "Shop" },
                        ],
                    ],
                ],
            })
            const { service, movements, office } = await build(em)
            movements.apply
                .mockResolvedValueOnce({ applied: true, before: 10, after: 6, cost: 0 })
                .mockResolvedValueOnce({ applied: true, before: 0, after: 4, cost: 0 })

            await expect(service.transferStock("user-1", "ws-1", request)).resolves.toEqual({ from: 6, to: 4 })

            const key = new Date("2026-10-12T08:00:00.000Z").getTime()
            const reason = text("inventory.transferReason", { from: "Main", to: "Shop", note: ": for the shop" })
            expect(movements.apply).toHaveBeenNthCalledWith(1, "ws-1", {
                itemId: "item-1",
                locationId: "loc-1",
                kind: "transfer",
                delta: -4,
                reason,
                refType: "transfer",
                by: "Lan",
                dedupe: `transfer:${key}:out:item-1`,
            })
            expect(movements.apply).toHaveBeenNthCalledWith(2, "ws-1", {
                itemId: "item-1",
                locationId: "loc-2",
                kind: "transfer",
                delta: 4,
                reason,
                refType: "transfer",
                by: "Lan",
                dedupe: `transfer:${key}:in:item-1`,
            })
            expect(office.logEvidence).toHaveBeenCalledWith(
                "ws-1",
                expect.objectContaining({ kind: "inventory.transfer" }),
            )
        })

        it("words the reason without a note", async () => {
            const em = mockEntityManager({
                query: [
                    [SELECT_ITEM_LABEL, [{ name: "Tea", unit: "kg" }]],
                    [
                        SELECT_LOCATION_NAMES,
                        [
                            { id: "loc-1", name: "Main" },
                            { id: "loc-2", name: "Shop" },
                        ],
                    ],
                ],
            })
            const { service, movements } = await build(em)

            await service.transferStock("user-1", "ws-1", { ...request, note: "" })

            expect(movements.apply).toHaveBeenCalledWith(
                "ws-1",
                expect.objectContaining({
                    reason: text("inventory.transferReason", { from: "Main", to: "Shop", note: "" }),
                }),
            )
        })

        it("refuses the same location twice, a quantity that is not positive, an unknown item and an unknown location", async () => {
            const em = mockEntityManager({
                query: [
                    [SELECT_ITEM_LABEL, []],
                    [SELECT_ITEM_LABEL, [{ name: "Tea", unit: "kg" }]],
                    [SELECT_LOCATION_NAMES, [{ id: "loc-1", name: "Main" }]],
                    [SELECT_ITEM_LABEL, [{ name: "Tea", unit: "kg" }]],
                    [SELECT_LOCATION_NAMES, [{ id: "loc-2", name: "Shop" }]],
                ],
            })
            const { service } = await build(em)

            await expect(
                service.transferStock("user-1", "ws-1", { ...request, toLocationId: "loc-1" }),
            ).rejects.toMatchObject({ code: InventoryErrorCode.TransferSameLocation })
            await expect(service.transferStock("user-1", "ws-1", { ...request, qty: 0 })).rejects.toMatchObject({
                code: InventoryErrorCode.TransferQtyRequired,
            })
            await expect(service.transferStock("user-1", "ws-1", request)).rejects.toMatchObject({
                code: InventoryErrorCode.ItemNotFound,
            })
            await expect(service.transferStock("user-1", "ws-1", request)).rejects.toMatchObject({
                code: InventoryErrorCode.LocationNotFound,
            })
            await expect(service.transferStock("user-1", "ws-1", request)).rejects.toMatchObject({
                code: InventoryErrorCode.LocationNotFound,
            })
        })
    })

    describe("performAdjustStock", () => {
        const context = {
            workspaceId: "ws-1",
            workItemId: "work-1",
            actor: "Lan",
            draft: null,
            fields: {
                item_id: "item-1",
                location_id: UUID,
                delta: -3,
                reason: "spoiled",
                evidence: "photo",
                ref_type: "count",
            },
        }

        it("applies the approved change as a movement and queues the check", async () => {
            const em = mockEntityManager({ query: [SELECT_ITEM_LABEL, [{ name: "Tea", unit: "kg" }]] })
            const { service, movements } = await build(em)

            const result = await service.performAdjustStock(context)

            expect(movements.apply).toHaveBeenCalledWith("ws-1", {
                itemId: "item-1",
                locationId: UUID,
                kind: "adjust",
                delta: -3,
                reason: "spoiled",
                refType: "count",
                by: "Lan",
                evidence: "photo",
                dedupe: "adjust:work-1",
            })
            expect(movements.replenishLater).toHaveBeenCalledWith("ws-1", ["item-1"])
            expect(result).toMatchObject({ evidence: "captured", href: "/agents/inventory/workbench?tab=history" })
        })

        it("falls back to the default reason, the default location and a manual reference", async () => {
            const em = mockEntityManager({ query: [SELECT_ITEM_LABEL, [{ name: "Tea", unit: "kg" }]] })
            const { service, movements } = await build(em)

            await service.performAdjustStock({ ...context, fields: { item_id: "item-1", delta: 2 } })

            expect(movements.apply).toHaveBeenCalledWith("ws-1", {
                itemId: "item-1",
                kind: "adjust",
                delta: 2,
                reason: text("inventory.adjustDefaultReason"),
                refType: "manual",
                by: "Lan",
                evidence: null,
                dedupe: "adjust:work-1",
            })
        })

        it("refuses an unknown item", async () => {
            const em = mockEntityManager({ query: [SELECT_ITEM_LABEL, []] })
            const { service } = await build(em)

            await expect(service.performAdjustStock(context)).rejects.toMatchObject({
                code: InventoryErrorCode.ItemNotFound,
            })
        })
    })
})
