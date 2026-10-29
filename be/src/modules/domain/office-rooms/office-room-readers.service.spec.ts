import { Test } from "@nestjs/testing"
import { fakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { OfficeRoomReadersService } from "./office-room-readers.service"
import { OfficeRoomReadEntity } from "./persistence/entities"

const reading = async (rows: ReadonlyArray<unknown>) => {
    const em = mockEntityManager()
    const fake = fakeQueryBuilder({ getRawMany: rows })
    em.createQueryBuilder.mockReturnValue(fake.builder)
    const moduleRef = await Test.createTestingModule({
        providers: [OfficeRoomReadersService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return { service: moduleRef.get(OfficeRoomReadersService), em, fake }
}

describe("OfficeRoomReadersService > readersAt", () => {
    it("answers the accounts whose marker is at or past the instant, each with how it stands", async () => {
        const rows = [
            { userId: "u1", standing: "later" },
            { userId: "u2", standing: "equal" },
        ]
        const { service, em, fake } = await reading(rows)

        await expect(service.readersAt("ws", "sales", ["u1", "u2"], "2026-10-25T01:00:00+00:00")).resolves.toEqual(rows)
        expect(em.createQueryBuilder).toHaveBeenCalledWith(OfficeRoomReadEntity, "rd")
        expect(fake.callsOf("where")[0]?.[1]).toEqual({ workspaceId: "ws", userIds: ["u1", "u2"] })
        expect(fake.callsOf("andWhere")[0]?.[1]).toEqual({ room: "sales" })
        expect(fake.callsOf("limit")).toEqual([[2]])
    })

    it("reads nothing for no accounts", async () => {
        const { service, em } = await reading([])

        await expect(service.readersAt("ws", null, [], "2026-10-25T01:00:00+00:00")).resolves.toEqual([])
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })

    it("reads through the manager it is handed", async () => {
        const { service, em } = await reading([])
        const { em: handed } = await reading([])

        await service.readersAt("ws", null, ["u1"], "2026-10-25T01:00:00+00:00", handed)

        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })
})
