import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { queueSubQueryBuilders } from "@tests/fixtures/builders/sub-query-builder.builder"
import { ChatRoomDirectoryService } from "./chat-room-directory.service"

const build = async () => {
    const em = mockEntityManager()
    const moduleRef = await Test.createTestingModule({
        providers: [ChatRoomDirectoryService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return { service: moduleRef.get(ChatRoomDirectoryService), em }
}

describe("ChatRoomDirectoryService", () => {
    it("names the groups of a workspace by room id, a group with no name as an empty text", async () => {
        const { service, em } = await build()
        const [read] = queueSubQueryBuilders(em, [
            {
                getMany: [
                    { id: "r1", name: "Sales" },
                    { id: "r2", name: null },
                ],
            },
        ])

        await expect(service.labelsOf("w1", ["r1", "r2"], 10)).resolves.toEqual([
            { key: "r1", name: "Sales" },
            { key: "r2", name: "" },
        ])
        expect(read?.argsOf("where")).toContainEqual([
            "r.workspace_id = :workspaceId AND r.kind = :kind AND r.id IN (:...roomIds)",
            { workspaceId: "w1", kind: "group", roomIds: ["r1", "r2"] },
        ])
        expect(read?.argsOf("limit")).toContainEqual([10])
    })

    it("looks nothing up for no room ids and no accounts", async () => {
        const { service, em } = await build()
        await expect(service.labelsOf("w1", [], 10)).resolves.toEqual([])
        await expect(service.seatRoomsOf("w1", [], 10)).resolves.toEqual([])
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })

    it("lists the groups the accounts sit in, as the account and the room, never a direct room", async () => {
        const { service, em } = await build()
        const [read] = queueSubQueryBuilders(em, [{ getMany: [{ memberId: "u1", roomId: "r1" }] }])

        await expect(service.seatRoomsOf("w1", ["u1"], 50)).resolves.toEqual([{ userId: "u1", key: "r1" }])
        expect(read?.argsOf("where")).toContainEqual([
            "m.member_kind = :user AND m.member_id IN (:...userIds)",
            { user: "user", userIds: ["u1"] },
        ])
        expect(read?.argsOf("innerJoin")[0]?.[3]).toEqual({ workspaceId: "w1", kind: "group" })
    })
})
