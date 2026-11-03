import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { SAVE_ITEM, SET_ITEM_ACTIVE } from "@tests/fixtures/builders/inventory-calls.builder"
import { ConnectionsError, ConnectionsErrorCode } from "@modules/domain/connections"
import { InventoryItemEntity } from "@modules/domain/inventory"
import { WorkspacesService } from "@modules/domain/workspaces"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { CatalogueSeedService } from "./catalogue-seed.service"
import { CATALOGUE_SEED_SCHEMA } from "./catalogue-seed.contracts"
import { CHANNEL_PROVISIONING_OPTIONS } from "./channel-provisioning.decorators"

const ITEM = { sku: "CHAU-MINI", name: "Chậu hoa mini", unit: "chậu", sellPriceVnd: 5000 }
const TEXT = `${JSON.stringify({ documents: [{ path: "data/catalogue.json", document: { schema: CATALOGUE_SEED_SCHEMA, items: [ITEM] } }] })}\n`

const stored = (over: Partial<InventoryItemEntity> = {}): InventoryItemEntity =>
    Object.assign(new InventoryItemEntity(), {
        id: "item-1",
        workspaceId: "ws-1",
        sku: "CHAU-MINI",
        name: "Chậu hoa mini",
        unit: "chậu",
        units: [{ unit: "thùng", factor: 10 }],
        category: "Hoa",
        costVnd: "2000.00",
        sellPriceVnd: "5000.00",
        reorderPoint: "3.000",
        reorderQty: "10.000",
        supplierId: "supplier-1",
        aliases: ["chau"],
        active: true,
        ...over,
    })

const build = async (found: InventoryItemEntity | null, workspaces = [{ id: "ws-1", name: "NIVO" }]) => {
    const em: MockEntityManager = mockEntityManager({
        findOne: [InventoryItemEntity, found],
        query: [SAVE_ITEM, [{ inventory_save_item: "item-1" }]],
    })
    const calls: Array<string> = []
    em.query.mockImplementation((statement: string) => {
        calls.push(statement)
        return Promise.resolve(statement === SET_ITEM_ACTIVE ? [] : [{ inventory_save_item: "item-1" }])
    })
    const list = mock<WorkspacesService>()
    list.list.mockResolvedValue(workspaces)
    const print = jest.fn<void, [string]>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            CatalogueSeedService,
            { provide: CHANNEL_PROVISIONING_OPTIONS, useValue: { print } },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: WorkspacesService, useValue: list },
        ],
    }).compile()
    return { service: moduleRef.get(CatalogueSeedService), em, calls, print }
}

describe("CatalogueSeedService > run", () => {
    it("creates an item the workspace does not have, with the price and no cost, stock rule or alias", async () => {
        const { service, em, calls, print } = await build(null)

        await service.run(TEXT, "NIVO")

        expect(em.query).toHaveBeenCalledWith(SAVE_ITEM, [
            "ws-1", null, "CHAU-MINI", "Chậu hoa mini", "chậu", "[]", "", 0, 5000, 0, 0, null, [],
        ])
        expect(calls).toEqual([SAVE_ITEM])
        expect(print.mock.calls).toEqual([["catalogue CHAU-MINI created"]])
    })

    it("changes nothing for an item that already is the wanted one, whatever the decimals of its stored price", async () => {
        const { service, calls, print } = await build(stored())

        await service.run(TEXT, "NIVO")

        expect(calls).toEqual([])
        expect(print.mock.calls).toEqual([["catalogue CHAU-MINI kept"]])
    })

    it("brings a changed item back to the wanted name, unit and price, keeping its cost, stock rule, units and aliases", async () => {
        const { service, em, print } = await build(stored({ name: "Old", sellPriceVnd: "9000.00" }))

        await service.run(TEXT, "NIVO")

        expect(em.query).toHaveBeenCalledWith(SAVE_ITEM, [
            "ws-1", "item-1", "CHAU-MINI", "Chậu hoa mini", "chậu", '[{"unit":"thùng","factor":10}]', "Hoa",
            "2000.00", 5000, "3.000", "10.000", "supplier-1", ["chau"],
        ])
        expect(print.mock.calls).toEqual([["catalogue CHAU-MINI updated"]])
    })

    it("switches an item that was turned off back on", async () => {
        const { service, calls } = await build(stored({ active: false }))

        await service.run(TEXT, "NIVO")

        expect(calls).toEqual([SAVE_ITEM, SET_ITEM_ACTIVE])
    })

    it.each([
        ["no workspace of that name", []],
        [
            "two workspaces of that name",
            [
                { id: "ws-1", name: "NIVO" },
                { id: "ws-2", name: "NIVO" },
            ],
        ],
    ])("refuses %s before it writes anything", async (_name, workspaces) => {
        const { service, calls } = await build(null, workspaces)

        await expect(service.run(TEXT, "NIVO")).rejects.toThrow(
            new ConnectionsError({ code: ConnectionsErrorCode.CommandInvalid, params: { field: "workspace" } }),
        )

        expect(calls).toEqual([])
    })
})
