import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { InventoryErrorCode } from "./errors/inventory.error"
import { InventoryLocationsService } from "./inventory-locations.service"
import { DEFAULT_LOCATION, SAVE_LOCATION } from "./persistence/inventory.sql"

const UUID = "0b8c1f0e-3a49-4b7e-9d3f-2c1f6a5d7e90"

const build = async (entityManager: MockEntityManager) => {
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key) => key)
    const members = mock<WorkspaceMembersService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            InventoryLocationsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: WorkspaceMembersService, useValue: members },
        ],
    }).compile()
    return { locations: moduleRef.get(InventoryLocationsService), members }
}

describe("InventoryLocationsService", () => {
    describe("defaultLocation", () => {
        it("answers the default location of the workspace, created with the catalogue name on first use", async () => {
            const em = mockEntityManager({ query: [DEFAULT_LOCATION, [{ id: "loc-1" }]] })
            const { locations } = await build(em)

            await expect(locations.defaultLocation("ws-1")).resolves.toBe("loc-1")

            expect(em.query).toHaveBeenCalledWith(DEFAULT_LOCATION, ["ws-1", "inventory.defaultLocationName"])
        })

        it("refuses when the database answers no location", async () => {
            const em = mockEntityManager({ query: [DEFAULT_LOCATION, [{ id: null }]] })
            const { locations } = await build(em)

            await expect(locations.defaultLocation("ws-1")).rejects.toMatchObject({
                code: InventoryErrorCode.LocationNotCreated,
            })
        })

        it("refuses when the database answers no row", async () => {
            const em = mockEntityManager({ query: [DEFAULT_LOCATION, []] })
            const { locations } = await build(em)

            await expect(locations.defaultLocation("ws-1")).rejects.toMatchObject({
                code: InventoryErrorCode.LocationNotCreated,
            })
        })
    })

    describe("saveLocation", () => {
        it("renames the named location after proving the caller is a manager", async () => {
            const em = mockEntityManager({ query: [SAVE_LOCATION, [{ id: UUID }]] })
            const { locations, members } = await build(em)

            await locations.saveLocation("user-1", "ws-1", { id: UUID, name: "  Back store  " })

            expect(members.require).toHaveBeenCalledWith("user-1", "ws-1", ["owner", "manager"])
            expect(em.query).toHaveBeenCalledWith(SAVE_LOCATION, ["ws-1", UUID, "Back store"])
        })

        it("makes sure the default location exists before adding another one", async () => {
            const em = mockEntityManager({
                query: [
                    [DEFAULT_LOCATION, [{ id: "loc-1" }]],
                    [SAVE_LOCATION, [{ id: "loc-2" }]],
                ],
            })
            const { locations } = await build(em)

            await locations.saveLocation("user-1", "ws-1", { name: "Counter" })

            expect(em.query).toHaveBeenNthCalledWith(2, SAVE_LOCATION, ["ws-1", null, "Counter"])
        })

        it("refuses an empty name and writes nothing", async () => {
            const em = mockEntityManager()
            const { locations } = await build(em)

            await expect(locations.saveLocation("user-1", "ws-1", { name: "   " })).rejects.toMatchObject({
                code: InventoryErrorCode.LocationNameRequired,
            })

            expect(em.query).not.toHaveBeenCalled()
        })
    })
})
