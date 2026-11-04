import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import type { NodeDataPort, NodeTurn } from "@modules/domain/graph-nodes"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { entityOf } from "@tests/fixtures/builders/entity.builder"
import { InventoryGraphService } from "./inventory-graph.service"
import { InventoryItemEntity } from "./persistence/entities"

const TURN: NodeTurn = {
    turnId: "turn-1",
    workspaceId: "ws-1",
    agentId: "agent-1",
    subject: null,
    conversationId: null,
    locale: "vi",
}

const itemOf = entityOf(InventoryItemEntity, {
    id: "item-1",
    sku: "TEA",
    name: "Tea",
    unit: "box",
    sellPriceVnd: "120000",
    active: true,
})

const build = async (withRegistry = true) => {
    const em = mockEntityManager({
        find: [[InventoryItemEntity, [itemOf(), itemOf({ id: "item-2", sellPriceVnd: null, active: false })]]],
    })
    const registry = mock<GraphNodeRegistryService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            InventoryGraphService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            ...(withRegistry ? [{ provide: GraphNodeRegistryService, useValue: registry }] : []),
        ],
    }).compile()
    moduleRef.get(InventoryGraphService).onModuleInit()
    return { em, registry, port: registry.addDataPort.mock.calls[0]?.[0] as NodeDataPort }
}

describe("InventoryGraphService", () => {
    it("registers the catalogue-item port, and nothing when the app hosts no graph nodes", async () => {
        const { port } = await build()
        const { registry } = await build(false)

        expect(port.kind).toBe("catalogue-item")
        expect(registry.addDataPort).not.toHaveBeenCalled()
    })

    it("reads the items of the turn workspace with their selling price as a number", async () => {
        const { em, port } = await build()

        const rows = await port.read(TURN, { fields: ["id", "sku", "name", "unit", "priceVnd", "active"] }, "workspace")

        expect(em.find).toHaveBeenCalledWith(InventoryItemEntity, {
            where: { workspaceId: "ws-1" },
            order: { name: "ASC" },
            take: 500,
        })
        expect(rows).toEqual([
            { id: "item-1", sku: "TEA", name: "Tea", unit: "box", priceVnd: 120000, active: true },
            { id: "item-2", sku: "TEA", name: "Tea", unit: "box", priceVnd: null, active: false },
        ])
    })

    it("answers the same items for a turn scope, filtered by where", async () => {
        const { port } = await build()

        await expect(port.read(TURN, { where: { active: true }, fields: ["id"] }, "turn")).resolves.toEqual([
            { id: "item-1" },
        ])
    })
})
