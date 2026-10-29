import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { queueSubQueryBuilders } from "@tests/fixtures/builders/sub-query-builder.builder"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { entityOf } from "@tests/fixtures/builders/entity.builder"
import { OfficeRoomDirectoryService } from "./office-room-directory.service"
import { OfficeRoomEntity, OfficeRoomMemberEntity } from "./persistence/entities"

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [OfficeRoomDirectoryService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(OfficeRoomDirectoryService)
}

describe("OfficeRoomDirectoryService", () => {
    it("asks for no label when no key is given", async () => {
        const em = mockEntityManager()

        await expect((await build(em)).labelsOf("ws-1", [], 10)).resolves.toEqual([])
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })

    it("reads the names of the given rooms in room order, bounded", async () => {
        const em = mockEntityManager()
        const [read] = queueSubQueryBuilders(em, [{ getRawMany: [{ key: "sales", name: "Sales" }] }])

        await expect((await build(em)).labelsOf("ws-1", ["sales"], 10)).resolves.toEqual([
            { key: "sales", name: "Sales" },
        ])
        expect(read?.argsOf("where")).toContainEqual([
            "r.workspace_id = :workspaceId AND r.key IN (:...keys)",
            { workspaceId: "ws-1", keys: ["sales"] },
        ])
        expect(read?.argsOf("orderBy")).toContainEqual(["r.position", "ASC"])
        expect(read?.argsOf("addOrderBy")).toContainEqual(["r.key", "ASC"])
        expect(read?.argsOf("limit")).toContainEqual([10])
    })

    it("asks for no seat when no account is given", async () => {
        const em = mockEntityManager()

        await expect((await build(em)).seatRoomsOf("ws-1", [], 50)).resolves.toEqual([])
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })

    it("reads the rooms of the workspace the given accounts sit in, in room order, bounded", async () => {
        const em = mockEntityManager()
        const [read] = queueSubQueryBuilders(em, [{ getRawMany: [{ userId: "u-1", key: "sales" }] }])

        await expect((await build(em)).seatRoomsOf("ws-1", ["u-1"], 50)).resolves.toEqual([
            { userId: "u-1", key: "sales" },
        ])
        expect(read?.argsOf("innerJoin")).toContainEqual([
            expect.anything(),
            "r",
            "r.id = rm.room_id AND r.workspace_id = :workspaceId",
            { workspaceId: "ws-1" },
        ])
        expect(read?.argsOf("where")).toContainEqual(["rm.userId IN (:...userIds)", { userIds: ["u-1"] }])
        expect(read?.argsOf("orderBy")).toContainEqual(["r.position", "ASC"])
        expect(read?.argsOf("limit")).toContainEqual([50])
    })

    it("asks for no staffed room when the keys are an empty list", async () => {
        const em = mockEntityManager()

        await expect((await build(em)).staffedRooms("ws-1", [], 10)).resolves.toEqual([])
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })

    it("reads the rooms with a person in them in room order, bounded", async () => {
        const em = mockEntityManager()
        const [read] = queueSubQueryBuilders(em, [{ getRawMany: [{ key: "sales", name: "Sales" }] }])

        await expect((await build(em)).staffedRooms("ws-1", null, 20)).resolves.toEqual([
            { key: "sales", name: "Sales" },
        ])
        expect(read?.argsOf("where")).toContainEqual(["r.workspace_id = :workspaceId", { workspaceId: "ws-1" }])
        expect(read?.argsOf("where")).toContainEqual(["rm.room_id = r.id AND rm.user_id IS NOT NULL"])
        expect(read?.argsOf("andWhereExists")).toHaveLength(1)
        expect(read?.argsOf("andWhere")).toEqual([])
        expect(read?.argsOf("orderBy")).toContainEqual(["r.position", "ASC"])
        expect(read?.argsOf("limit")).toContainEqual([20])
    })

    it("narrows the staffed rooms to the given keys", async () => {
        const em = mockEntityManager()
        const [read] = queueSubQueryBuilders(em, [{ getRawMany: [] }])

        await expect((await build(em)).staffedRooms("ws-1", ["sales"], 20)).resolves.toEqual([])
        expect(read?.argsOf("andWhere")).toContainEqual(["r.key IN (:...keys)", { keys: ["sales"] }])
    })

    it("answers the name of the home room of an agent, null when it has none", async () => {
        const home = mockEntityManager({
            findOne: [
                [OfficeRoomMemberEntity, entityOf(OfficeRoomMemberEntity, { roomId: "r1" })()],
                [OfficeRoomEntity, entityOf(OfficeRoomEntity, { name: "Sales" })()],
            ],
        })
        const homeless = mockEntityManager({ findOne: [OfficeRoomMemberEntity, null] })

        await expect((await build(home)).homeRoomNameOf("ws-1", "a1")).resolves.toBe("Sales")
        expect(home.findOne).toHaveBeenCalledWith(OfficeRoomMemberEntity, {
            select: { roomId: true },
            where: { agentId: "a1", isHome: true },
        })
        expect(home.findOne).toHaveBeenCalledWith(OfficeRoomEntity, {
            select: { name: true },
            where: { id: "r1", workspaceId: "ws-1" },
        })
        await expect((await build(homeless)).homeRoomNameOf("ws-1", "a9")).resolves.toBeNull()
    })
})
