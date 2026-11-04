import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ConnectionsError, ConnectionsErrorCode } from "@modules/domain/connections"
import { InventorySeedService } from "@modules/domain/inventory"
import { WorkspacesService } from "@modules/domain/workspaces"
import { CatalogueSeedService } from "./catalogue-seed.service"
import { CATALOGUE_SEED_SCHEMA } from "./catalogue-seed.contracts"
import { CHANNEL_PROVISIONING_OPTIONS } from "./channel-provisioning.decorators"

const ITEM = { sku: "CHAU-MINI", name: "Mini pot", unit: "pot", sellPriceVnd: 5000 }
const TEXT = `${JSON.stringify({ documents: [{ path: "data/catalogue.json", document: { schema: CATALOGUE_SEED_SCHEMA, items: [ITEM] } }] })}\n`

const build = async (workspaces = [{ id: "ws-1", name: "NIVO" }]) => {
    const inventory = mock<InventorySeedService>()
    inventory.ensureItem.mockResolvedValue("created")
    const list = mock<WorkspacesService>()
    list.list.mockResolvedValue(workspaces)
    const print = jest.fn<void, [string]>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            CatalogueSeedService,
            { provide: CHANNEL_PROVISIONING_OPTIONS, useValue: { print } },
            { provide: InventorySeedService, useValue: inventory },
            { provide: WorkspacesService, useValue: list },
        ],
    }).compile()
    return { service: moduleRef.get(CatalogueSeedService), inventory, print }
}

describe("CatalogueSeedService > run", () => {
    it.each([["created"], ["updated"], ["kept"]] as const)(
        "ensures each item in the named workspace and prints that it was %s",
        async (outcome) => {
            const { service, inventory, print } = await build()
            inventory.ensureItem.mockResolvedValue(outcome)

            await service.run(TEXT, "NIVO")

            expect(inventory.ensureItem).toHaveBeenCalledWith("ws-1", ITEM)
            expect(print.mock.calls).toEqual([[`catalogue CHAU-MINI ${outcome}`]])
        },
    )
})

describe("CatalogueSeedService > refusals", () => {
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
        const { service, inventory } = await build(workspaces)

        await expect(service.run(TEXT, "NIVO")).rejects.toThrow(
            new ConnectionsError({ code: ConnectionsErrorCode.CommandInvalid, params: { field: "workspace" } }),
        )

        expect(inventory.ensureItem).not.toHaveBeenCalled()
    })
})
