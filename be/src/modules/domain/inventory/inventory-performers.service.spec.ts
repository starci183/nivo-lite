import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ActionPerformerRegistry } from "@modules/domain/module-ops"
import type { PerformContext } from "@modules/domain/module-ops"
import { InventoryDispatchService } from "./inventory-dispatch.service"
import { InventoryPerformersService } from "./inventory-performers.service"
import { InventoryStockService } from "./inventory-stock.service"

const context: PerformContext = { workspaceId: "ws-1", workItemId: "work-1", actor: "Lan", draft: null, fields: {} }

const build = async () => {
    const registry = mock<ActionPerformerRegistry>()
    const stock = mock<InventoryStockService>()
    const dispatch = mock<InventoryDispatchService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            InventoryPerformersService,
            { provide: ActionPerformerRegistry, useValue: registry },
            { provide: InventoryStockService, useValue: stock },
            { provide: InventoryDispatchService, useValue: dispatch },
        ],
    }).compile()
    return { service: moduleRef.get(InventoryPerformersService), registry, stock, dispatch }
}

describe("InventoryPerformersService", () => {
    it("registers the adjust_stock and send_purchase_order performers", async () => {
        const { service, registry } = await build()

        service.onModuleInit()

        expect(registry.add).toHaveBeenCalledTimes(2)
        expect(registry.add).toHaveBeenCalledWith(expect.objectContaining({ action: "adjust_stock" }))
        expect(registry.add).toHaveBeenCalledWith(expect.objectContaining({ action: "send_purchase_order" }))
    })

    it("runs the stock service for an allowed stock adjustment", async () => {
        const { service, registry, stock } = await build()
        stock.performAdjustStock.mockResolvedValue({ summary: "done", evidence: "captured" })
        service.onModuleInit()
        const performer = registry.add.mock.calls[0]?.[0]

        await expect(performer?.perform(context)).resolves.toEqual({ summary: "done", evidence: "captured" })

        expect(stock.performAdjustStock).toHaveBeenCalledWith(context)
        expect(performer?.reject).toBeUndefined()
    })

    it("sends through the dispatch service and cleans up after a refusal", async () => {
        const { service, registry, dispatch } = await build()
        dispatch.performSendPurchaseOrder.mockResolvedValue({ summary: "sent", evidence: "captured" })
        service.onModuleInit()
        const performer = registry.add.mock.calls[1]?.[0]

        await expect(performer?.perform(context)).resolves.toEqual({ summary: "sent", evidence: "captured" })
        await performer?.reject?.(context)

        expect(dispatch.performSendPurchaseOrder).toHaveBeenCalledWith(context)
        expect(dispatch.rejectSendPurchaseOrder).toHaveBeenCalledWith(context)
    })
})
