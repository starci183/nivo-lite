import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { DomainError } from "@modules/platform/errors"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { InventoryError, InventoryErrorCode } from "./errors/inventory.error"
import { InventoryCatalogService } from "./inventory-catalog.service"
import { InventoryCommandService } from "./inventory-command.service"
import { InventoryDispatchService } from "./inventory-dispatch.service"
import { InventoryImportService } from "./inventory-import.service"
import { InventoryLocationsService } from "./inventory-locations.service"
import { InventoryOrdersService } from "./inventory-orders.service"
import { InventoryReceivingService } from "./inventory-receiving.service"
import { InventoryReplenishService } from "./inventory-replenish.service"
import { InventoryStockService } from "./inventory-stock.service"
import { InventoryLogEvent } from "./inventory.log-events"
import type { InventoryCommandsRow } from "./persistence/inventory.rows"
import { FINISH_COMMAND, SELECT_COMMAND } from "./persistence/inventory.sql"

class MembershipError extends DomainError<"MEMBERSHIP_FORBIDDEN"> {}

const text = (key: string, params: Record<string, string | number> = {}): string => `${key}${JSON.stringify(params)}`

const commandRow = (kind: string, input: unknown, status = "queued"): InventoryCommandsRow => ({
    id: "command-1",
    workspace_id: "ws-1",
    kind,
    input,
    status,
    created_by: "user-1",
})

const queuedCommand = (kind: string, input: unknown, status = "queued") =>
    mockEntityManager({
        query: [
            [SELECT_COMMAND, [commandRow(kind, input, status)]],
            [FINISH_COMMAND, []],
        ],
    })

const build = async (entityManager: MockEntityManager) => {
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key, params) => text(key, params))
    const logger = mock<Logger>()
    const catalogue = mock<InventoryCatalogService>()
    const importing = mock<InventoryImportService>()
    const locations = mock<InventoryLocationsService>()
    const stock = mock<InventoryStockService>()
    const orders = mock<InventoryOrdersService>()
    const dispatch = mock<InventoryDispatchService>()
    const receiving = mock<InventoryReceivingService>()
    const replenish = mock<InventoryReplenishService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            InventoryCommandService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: LOGGER, useValue: logger },
            { provide: InventoryCatalogService, useValue: catalogue },
            { provide: InventoryImportService, useValue: importing },
            { provide: InventoryLocationsService, useValue: locations },
            { provide: InventoryStockService, useValue: stock },
            { provide: InventoryOrdersService, useValue: orders },
            { provide: InventoryDispatchService, useValue: dispatch },
            { provide: InventoryReceivingService, useValue: receiving },
            { provide: InventoryReplenishService, useValue: replenish },
        ],
    }).compile()
    return {
        service: moduleRef.get(InventoryCommandService),
        catalog,
        logger,
        catalogue,
        importing,
        locations,
        stock,
        orders,
        dispatch,
        receiving,
        replenish,
        effects: [
            catalogue.saveItem,
            catalogue.setItemActive,
            catalogue.saveSupplier,
            catalogue.saveRecipe,
            catalogue.deleteRecipe,
            locations.saveLocation,
            importing.importPasted,
            importing.applyStarter,
            stock.adjustStock,
            stock.stockTake,
            stock.transferStock,
            replenish.draftLowStock,
            orders.createPo,
            orders.updatePoDraft,
            dispatch.requestSend,
            orders.cancelPo,
            receiving.receivePo,
        ],
    }
}

const expectDone = (entityManager: MockEntityManager, result: string | null) => {
    expect(entityManager.query.mock.calls).toEqual([
        [SELECT_COMMAND, ["command-1", "ws-1"]],
        [FINISH_COMMAND, ["command-1", "done", result, null, null]],
    ])
}

const expectFailed = (entityManager: MockEntityManager, code: string, message: string) => {
    expect(entityManager.query.mock.calls).toEqual([
        [SELECT_COMMAND, ["command-1", "ws-1"]],
        [FINISH_COMMAND, ["command-1", "failed", null, code, message]],
    ])
}

describe("InventoryCommandService", () => {
    describe("run", () => {
        it("leaves an unknown command unchanged", async () => {
            const em = mockEntityManager({ query: [SELECT_COMMAND, []] })
            const { service, effects } = await build(em)

            await service.run("command-1", "ws-1")

            expect(em.query.mock.calls).toEqual([[SELECT_COMMAND, ["command-1", "ws-1"]]])
            for (const effect of effects) expect(effect).not.toHaveBeenCalled()
        })

        it.each(["done", "failed"])("leaves a command already settled as %s unchanged", async (status) => {
            const em = queuedCommand("save-item", {}, status)
            const { service, effects } = await build(em)

            await service.run("command-1", "ws-1")

            expect(em.query.mock.calls).toEqual([[SELECT_COMMAND, ["command-1", "ws-1"]]])
            for (const effect of effects) expect(effect).not.toHaveBeenCalled()
        })

        it("saves an item as the submitting member and stores its id", async () => {
            const input = {
                id: "item-1",
                sku: "TEA",
                name: "Tea",
                unit: "kg",
                units: "box=10",
                category: "Dry",
                cost: "20000",
                sell: "25000",
                reorderPoint: "3",
                reorderQty: "8",
                supplierId: "supplier-1",
                aliases: "tra",
                openingQty: "4",
            }
            const em = queuedCommand("save-item", input)
            const { service, catalogue } = await build(em)
            catalogue.saveItem.mockResolvedValue({ id: "item-1" })

            await service.run("command-1", "ws-1")

            expect(catalogue.saveItem.mock.calls).toEqual([["user-1", "ws-1", input]])
            expectDone(em, `{"id":"item-1"}`)
        })

        it("switches an item off and stores a null result", async () => {
            const input = { id: "item-1", active: false }
            const em = queuedCommand("set-item-active", input)
            const { service, catalogue } = await build(em)
            catalogue.setItemActive.mockResolvedValue(undefined)

            await service.run("command-1", "ws-1")

            expect(catalogue.setItemActive.mock.calls).toEqual([["user-1", "ws-1", input]])
            expectDone(em, null)
        })

        it("saves a supplier and stores its id", async () => {
            const input = {
                id: "supplier-1",
                name: "Mill Co",
                contactName: "Lan",
                email: "lan@mill.vn",
                phone: "123",
                zalo: "456",
                channel: "email",
                leadTime: "2",
                terms: "7 days",
                note: "Deliver in the morning",
            }
            const em = queuedCommand("save-supplier", input)
            const { service, catalogue } = await build(em)
            catalogue.saveSupplier.mockResolvedValue({ id: "supplier-1" })

            await service.run("command-1", "ws-1")

            expect(catalogue.saveSupplier.mock.calls).toEqual([["user-1", "ws-1", input]])
            expectDone(em, `{"id":"supplier-1"}`)
        })

        it("saves a recipe and stores its id", async () => {
            const input = {
                id: "recipe-1",
                name: "Cake",
                aliases: "gato",
                lines: [{ itemId: "item-1", qty: "2" }],
            }
            const em = queuedCommand("save-recipe", input)
            const { service, catalogue } = await build(em)
            catalogue.saveRecipe.mockResolvedValue({ id: "recipe-1" })

            await service.run("command-1", "ws-1")

            expect(catalogue.saveRecipe.mock.calls).toEqual([["user-1", "ws-1", input]])
            expectDone(em, `{"id":"recipe-1"}`)
        })

        it("deletes a recipe and stores a null result", async () => {
            const input = { id: "recipe-1" }
            const em = queuedCommand("delete-recipe", input)
            const { service, catalogue } = await build(em)
            catalogue.deleteRecipe.mockResolvedValue(undefined)

            await service.run("command-1", "ws-1")

            expect(catalogue.deleteRecipe.mock.calls).toEqual([["user-1", "ws-1", input]])
            expectDone(em, null)
        })

        it("saves a location and stores a null result", async () => {
            const input = { id: "location-1", name: "Shop" }
            const em = queuedCommand("save-location", input)
            const { service, locations } = await build(em)
            locations.saveLocation.mockResolvedValue(undefined)

            await service.run("command-1", "ws-1")

            expect(locations.saveLocation.mock.calls).toEqual([["user-1", "ws-1", input]])
            expectDone(em, null)
        })

        it("imports pasted items and stores the import counts", async () => {
            const input = { raw: "SKU,Name\nTEA,Tea" }
            const em = queuedCommand("import-paste", input)
            const { service, importing } = await build(em)
            importing.importPasted.mockResolvedValue({ created: 2, updated: 3, stocked: 1, skipped: ["bad row"] })

            await service.run("command-1", "ws-1")

            expect(importing.importPasted.mock.calls).toEqual([["user-1", "ws-1", input]])
            expectDone(em, `{"created":2,"updated":3,"stocked":1,"skipped":["bad row"]}`)
        })

        it("applies a starter and stores the created counts", async () => {
            const input = {
                name: "Cafe",
                suppliers: [{ name: "Mill Co", channel: "email", leadTimeDays: 2 }],
                items: [
                    {
                        sku: "TEA",
                        name: "Tea",
                        unit: "kg",
                        category: "Dry",
                        costVnd: 20000,
                        reorderPoint: 3,
                        reorderQty: 8,
                        qty: 4,
                    },
                ],
                recipes: [{ name: "Cake", lines: [{ sku: "TEA", qty: 2 }] }],
            }
            const em = queuedCommand("apply-starter", input)
            const { service, importing } = await build(em)
            importing.applyStarter.mockResolvedValue({ items: 1, suppliers: 2, recipes: 3 })

            await service.run("command-1", "ws-1")

            expect(importing.applyStarter.mock.calls).toEqual([["user-1", "ws-1", input]])
            expectDone(em, `{"items":1,"suppliers":2,"recipes":3}`)
        })

        it("adjusts stock and stores the applied levels", async () => {
            const input = { itemId: "item-1", locationId: "location-1", delta: 2, reason: "Found" }
            const em = queuedCommand("adjust-stock", input)
            const { service, stock } = await build(em)
            stock.adjustStock.mockResolvedValue({ state: "applied", before: 4, after: 6 })

            await service.run("command-1", "ws-1")

            expect(stock.adjustStock.mock.calls).toEqual([["user-1", "ws-1", input]])
            expectDone(em, `{"state":"applied","before":4,"after":6}`)
        })

        it("takes stock and stores the count outcomes", async () => {
            const input = { counts: [{ itemId: "item-1", counted: 6 }] }
            const em = queuedCommand("stock-take", input)
            const { service, stock } = await build(em)
            stock.stockTake.mockResolvedValue({ applied: 1, waiting: 2, same: 3 })

            await service.run("command-1", "ws-1")

            expect(stock.stockTake.mock.calls).toEqual([["user-1", "ws-1", input]])
            expectDone(em, `{"applied":1,"waiting":2,"same":3}`)
        })

        it("transfers stock and stores both remaining levels", async () => {
            const input = {
                itemId: "item-1",
                fromLocationId: "location-1",
                toLocationId: "location-2",
                qty: 2,
                note: "For the shop",
            }
            const em = queuedCommand("transfer-stock", input)
            const { service, stock } = await build(em)
            stock.transferStock.mockResolvedValue({ from: 4, to: 2 })

            await service.run("command-1", "ws-1")

            expect(stock.transferStock.mock.calls).toEqual([["user-1", "ws-1", input]])
            expectDone(em, `{"from":4,"to":2}`)
        })

        it("drafts low stock without parameters and stores the draft counts", async () => {
            const em = queuedCommand("draft-low-stock", {})
            const { service, replenish } = await build(em)
            replenish.draftLowStock.mockResolvedValue({ drafted: 2, low: 3 })

            await service.run("command-1", "ws-1")

            expect(replenish.draftLowStock.mock.calls).toEqual([["user-1", "ws-1"]])
            expectDone(em, `{"drafted":2,"low":3}`)
        })

        it("creates a purchase order and stores its id", async () => {
            const input = {
                supplierId: "supplier-1",
                expectedAt: "2026-10-14",
                lines: [{ itemId: "item-1", qty: "2", unitCost: "20000" }],
            }
            const em = queuedCommand("create-po", input)
            const { service, orders } = await build(em)
            orders.createPo.mockResolvedValue({ id: "po-1" })

            await service.run("command-1", "ws-1")

            expect(orders.createPo.mock.calls).toEqual([["user-1", "ws-1", input]])
            expectDone(em, `{"id":"po-1"}`)
        })

        it("updates a draft purchase order and stores a null result", async () => {
            const input = {
                poId: "po-1",
                supplierId: "supplier-1",
                expectedAt: "2026-10-14",
                lines: [{ lineId: "line-1", qty: "2", unitCost: "20000" }],
            }
            const em = queuedCommand("update-po-draft", input)
            const { service, orders } = await build(em)
            orders.updatePoDraft.mockResolvedValue(undefined)

            await service.run("command-1", "ws-1")

            expect(orders.updatePoDraft.mock.calls).toEqual([["user-1", "ws-1", input]])
            expectDone(em, null)
        })

        it("requests a reminder and stores the dispatch status", async () => {
            const input = { poId: "po-1", kind: "reminder" }
            const em = queuedCommand("request-send", input)
            const { service, dispatch } = await build(em)
            dispatch.requestSend.mockResolvedValue({ status: "waiting" })

            await service.run("command-1", "ws-1")

            expect(dispatch.requestSend.mock.calls).toEqual([["user-1", "ws-1", input]])
            expectDone(em, `{"status":"waiting"}`)
        })

        it("cancels a purchase order and stores a null result", async () => {
            const input = { poId: "po-1" }
            const em = queuedCommand("cancel-po", input)
            const { service, orders } = await build(em)
            orders.cancelPo.mockResolvedValue(undefined)

            await service.run("command-1", "ws-1")

            expect(orders.cancelPo.mock.calls).toEqual([["user-1", "ws-1", input]])
            expectDone(em, null)
        })

        it("receives a purchase order and stores the receipt outcome", async () => {
            const input = {
                poId: "po-1",
                invoiceNo: "INV-1",
                note: "Delivered",
                lines: [{ lineId: "line-1", qty: "2", unitCost: "22000" }],
            }
            const em = queuedCommand("receive-po", input)
            const { service, receiving } = await build(em)
            receiving.receivePo.mockResolvedValue({
                status: "received",
                received: 1,
                priceChanges: ["Tea"],
                payableVnd: 44000,
                handedToAccounting: true,
            })

            await service.run("command-1", "ws-1")

            expect(receiving.receivePo.mock.calls).toEqual([["user-1", "ws-1", input]])
            expectDone(
                em,
                `{"status":"received","received":1,"priceChanges":["Tea"],"payableVnd":44000,"handedToAccounting":true}`,
            )
        })

        it("settles an unsupported kind as failed with the catalog sentence", async () => {
            const em = queuedCommand("foreign-command", {})
            const { service, effects, catalog, logger } = await build(em)

            await service.run("command-1", "ws-1")

            expectFailed(em, "INVENTORY_COMMAND_FAILED", "inventory.commandFailed{}")
            expect(catalog.get.mock.calls).toEqual([["inventory.commandFailed", {}, "vi"]])
            for (const effect of effects) expect(effect).not.toHaveBeenCalled()
            expect(logger.error).not.toHaveBeenCalled()
        })

        it("settles an inventory refusal as failed with its code and catalog sentence", async () => {
            const em = queuedCommand("delete-recipe", { id: "missing" })
            const { service, catalogue, catalog, logger } = await build(em)
            catalogue.deleteRecipe.mockRejectedValue(
                new InventoryError({ code: InventoryErrorCode.RecipeNotFound, params: { id: "missing" } }),
            )

            await service.run("command-1", "ws-1")

            expectFailed(em, "INVENTORY_RECIPE_NOT_FOUND", `errors.INVENTORY_RECIPE_NOT_FOUND{"id":"missing"}`)
            expect(catalog.get.mock.calls).toEqual([["errors.INVENTORY_RECIPE_NOT_FOUND", { id: "missing" }, "vi"]])
            expect(logger.error).not.toHaveBeenCalled()
        })

        it("settles another domain refusal as failed with its code and catalog sentence", async () => {
            const em = queuedCommand("draft-low-stock", {})
            const { service, replenish, catalog, logger } = await build(em)
            replenish.draftLowStock.mockRejectedValue(
                new MembershipError({ code: "MEMBERSHIP_FORBIDDEN", params: { role: "viewer", attempts: 2 } }),
            )

            await service.run("command-1", "ws-1")

            expectFailed(em, "MEMBERSHIP_FORBIDDEN", `errors.MEMBERSHIP_FORBIDDEN{"role":"viewer","attempts":2}`)
            expect(catalog.get.mock.calls).toEqual([
                ["errors.MEMBERSHIP_FORBIDDEN", { role: "viewer", attempts: 2 }, "vi"],
            ])
            expect(logger.error).not.toHaveBeenCalled()
        })

        it("logs an unknown error and settles failed with the generic catalog sentence", async () => {
            const em = queuedCommand("delete-recipe", { id: "recipe-1" })
            const { service, catalogue, catalog, logger } = await build(em)
            catalogue.deleteRecipe.mockRejectedValue(new Error("Database unavailable"))

            await service.run("command-1", "ws-1")

            expectFailed(em, "INVENTORY_COMMAND_FAILED", "inventory.commandFailed{}")
            expect(catalog.get.mock.calls).toEqual([["inventory.commandFailed", {}, "vi"]])
            expect(logger.error.mock.calls).toEqual([
                [InventoryLogEvent.CommandFailed, { commandId: "command-1", kind: "delete-recipe" }],
            ])
        })
    })

    describe("runJob", () => {
        it("ignores a foreign payload", async () => {
            const em = mockEntityManager()
            const { service, effects } = await build(em)

            await service.runJob({ workspaceId: "ws-1", orderId: "order-1" })

            expect(em.query).not.toHaveBeenCalled()
            for (const effect of effects) expect(effect).not.toHaveBeenCalled()
        })

        it("runs the command named by an inventory command payload", async () => {
            const em = queuedCommand("draft-low-stock", {})
            const { service, replenish } = await build(em)
            replenish.draftLowStock.mockResolvedValue({ drafted: 1, low: 2 })

            await service.runJob({ commandId: "command-1", workspaceId: "ws-1" })

            expect(replenish.draftLowStock.mock.calls).toEqual([["user-1", "ws-1"]])
            expectDone(em, `{"drafted":1,"low":2}`)
        })
    })
})
