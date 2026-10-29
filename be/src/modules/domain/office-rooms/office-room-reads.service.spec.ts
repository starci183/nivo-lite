import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { queueSubQueryBuilders } from "@tests/fixtures/builders/sub-query-builder.builder"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { OfficeRoomReadsService } from "./office-room-reads.service"

const PARAMS = { workspaceId: "ws-1", userId: "u-1", displayName: "Mai Linh" }

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [OfficeRoomReadsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(OfficeRoomReadsService)
}

describe("OfficeRoomReadsService", () => {
    it("reads the department rooms as the caller, in list order, at most twenty", async () => {
        const em = mockEntityManager()
        const [read] = queueSubQueryBuilders(em, [{ getRawMany: [{ key: "sales" }] }])
        const service = await build(em)

        await expect(service.rooms("ws-1", "u-1", "Mai Linh")).resolves.toEqual([{ key: "sales" }])
        expect(read?.argsOf("where")).toContainEqual(["r.workspace_id = :workspaceId"])
        expect(read?.argsOf("setParameters")).toContainEqual([PARAMS])
        expect(read?.argsOf("orderBy")).toContainEqual(["r.position"])
        expect(read?.argsOf("addOrderBy")).toContainEqual(["r.key"])
        expect(read?.argsOf("limit")).toContainEqual([20])
    })

    it("reads the Office room summary of one workspace as the caller", async () => {
        const em = mockEntityManager()
        const [read] = queueSubQueryBuilders(em, [{ getRawOne: { unread: 2 } }])
        const service = await build(em)

        await expect(service.summary("ws-1", "u-1", "Mai Linh")).resolves.toEqual({ unread: 2 })
        expect(read?.argsOf("where")).toContainEqual(["ws.id = :workspaceId"])
        expect(read?.argsOf("setParameters")).toContainEqual([PARAMS])
    })

    it("answers no summary when the workspace row is gone", async () => {
        const em = mockEntityManager()
        queueSubQueryBuilders(em, [{ getRawOne: undefined }])
        const service = await build(em)

        await expect(service.summary("ws-1", "u-1", "Mai Linh")).resolves.toBeUndefined()
    })

    it("reads the agent conversations in agent order, at most one hundred", async () => {
        const em = mockEntityManager()
        const [read] = queueSubQueryBuilders(em, [{ getRawMany: [{ id: "a-1", unread: 1 }] }])
        const service = await build(em)

        await expect(service.agentConversations("ws-1", "u-1", "Mai Linh")).resolves.toEqual([{ id: "a-1", unread: 1 }])
        expect(read?.argsOf("orderBy")).toContainEqual(["a.id"])
        expect(read?.argsOf("limit")).toContainEqual([100])
    })

    it("reads the lead conversations in lead order, at most five hundred", async () => {
        const em = mockEntityManager()
        const [read] = queueSubQueryBuilders(em, [{ getRawMany: [{ id: "l-1", unread: 0 }] }])
        const service = await build(em)

        await expect(service.leadConversations("ws-1", "u-1", "Mai Linh")).resolves.toEqual([{ id: "l-1", unread: 0 }])
        expect(read?.argsOf("orderBy")).toContainEqual(["l.id"])
        expect(read?.argsOf("limit")).toContainEqual([500])
    })
})
