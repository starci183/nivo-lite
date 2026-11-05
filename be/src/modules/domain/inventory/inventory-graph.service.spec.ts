import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import type { NodeTurn } from "@modules/domain/graph-nodes"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { inventoryItemOf } from "@tests/fixtures/builders/inventory.builder"
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

const itemOf = (overrides: Parameters<typeof inventoryItemOf>[0] = {}) =>
    inventoryItemOf({ unit: "box", sellPriceVnd: "120000", ...overrides })

const items = () => [itemOf(), itemOf({ id: "item-2", sellPriceVnd: null, active: false })]

const build = async () => {
    const em = mockEntityManager({ find: [[InventoryItemEntity, items()]] })
    const registry = mock<GraphNodeRegistryService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            InventoryGraphService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: GraphNodeRegistryService, useValue: registry },
        ],
    }).compile()
    moduleRef.get(InventoryGraphService).onModuleInit()
    const [port] = registry.addDataPort.mock.calls.map(([registered]) => registered)
    return { em, registry, port }
}

const buildWithoutRegistry = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [InventoryGraphService, { provide: PRIMARY_ENTITY_MANAGER, useValue: mockEntityManager() }],
    }).compile()
    expect(() => moduleRef.get(InventoryGraphService).onModuleInit()).not.toThrow()
}

describe("InventoryGraphService", () => {
    it("registers the catalogue-item port, and nothing when the app hosts no graph nodes", async () => {
        const { port } = await build()

        expect(port?.kind).toBe("catalogue-item")
        await buildWithoutRegistry()
    })

    it("reads the items of the turn workspace with their selling price as a number", async () => {
        const { em, port } = await build()

        const rows = await port?.read(
            TURN,
            { fields: ["id", "sku", "name", "unit", "priceVnd", "active"] },
            "workspace",
        )

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

        await expect(port?.read(TURN, { where: { active: true }, fields: ["id"] }, "turn")).resolves.toEqual([
            { id: "item-1" },
        ])
    })
})
