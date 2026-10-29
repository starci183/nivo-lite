import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ConnectionFeedReadsService } from "./connection-feed-reads.service"
import { ConnectionEntity } from "./persistence/entities"

const connection = Object.assign(new ConnectionEntity(), {
    id: "c-1",
    workspaceId: "ws-1",
    name: "Bank",
    environment: "live",
})

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [ConnectionFeedReadsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(ConnectionFeedReadsService)
}

describe("ConnectionFeedReadsService", () => {
    it("answers the workspace of a connection", async () => {
        const em = mockEntityManager({ findOne: [ConnectionEntity, connection] })

        await expect((await build(em)).workspaceOf("c-1")).resolves.toBe("ws-1")
    })

    it("answers no workspace for a connection that is gone", async () => {
        const em = mockEntityManager({ findOne: [ConnectionEntity, null] })

        await expect((await build(em)).workspaceOf("c-1")).resolves.toBeUndefined()
    })

    it("answers the name and environment, reading through the given manager", async () => {
        const own = mockEntityManager({ findOne: [ConnectionEntity, null] })
        const inside = mockEntityManager({ findOne: [ConnectionEntity, connection] })

        await expect((await build(own)).stateOf("c-1", inside)).resolves.toEqual({ name: "Bank", environment: "live" })
        expect(own.findOne).not.toHaveBeenCalled()
    })

    it("answers no state for a connection that is gone", async () => {
        const em = mockEntityManager({ findOne: [ConnectionEntity, null] })

        await expect((await build(em)).stateOf("c-1")).resolves.toBeUndefined()
    })
})
