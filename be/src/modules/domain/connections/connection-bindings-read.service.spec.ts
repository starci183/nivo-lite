import { Test } from "@nestjs/testing"
import { entityOf } from "@tests/fixtures/builders/entity.builder"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { In } from "typeorm"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ConnectionBindingsReadService } from "./connection-bindings-read.service"
import { ConnectionEntity } from "./persistence/entities"

const connectionOf = entityOf(ConnectionEntity, {
    id: "c1",
    provider: "telegram",
    name: "Shop bot",
    status: "connected",
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    publicMeta: { bot_username: "  shop_bot ", account_masked: "   ", other: 3 },
})

const build = async (em: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [ConnectionBindingsReadService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return moduleRef.get(ConnectionBindingsReadService)
}

describe("ConnectionBindingsReadService > factsOf", () => {
    it("answers the facts of the connections, trimming the reported texts and dropping blank ones", async () => {
        const em = mockEntityManager({ find: [ConnectionEntity, [connectionOf()]] })

        await expect((await build(em)).factsOf(["c1", "c1"], 200)).resolves.toEqual([
            {
                id: "c1",
                provider: "telegram",
                name: "Shop bot",
                status: "connected",
                createdAt: new Date("2026-10-01T00:00:00.000Z"),
                botUsername: "shop_bot",
                accountMasked: null,
            },
        ])
        expect(em.find).toHaveBeenCalledWith(ConnectionEntity, {
            select: { id: true, provider: true, name: true, status: true, createdAt: true, publicMeta: true },
            where: { id: In(["c1"]) },
            take: 200,
        })
    })

    it("treats a non-text report as none", async () => {
        const em = mockEntityManager({ find: [ConnectionEntity, [connectionOf({ publicMeta: { bot_username: 5 } })]] })

        await expect((await build(em)).factsOf(["c1"], 5)).resolves.toMatchObject([
            { botUsername: null, accountMasked: null },
        ])
    })

    it("reads nothing for no connections", async () => {
        const em = mockEntityManager()

        await expect((await build(em)).factsOf([], 5)).resolves.toEqual([])
        expect(em.find).not.toHaveBeenCalled()
    })
})

describe("ConnectionBindingsReadService > holds", () => {
    it("is true when the workspace holds the connection, read under a shared lock", async () => {
        const handed = mockEntityManager({ findOne: [ConnectionEntity, connectionOf()] })
        const service = await build(mockEntityManager())

        await expect(service.holds("w1", "c1", handed)).resolves.toBe(true)
        expect(handed.findOne).toHaveBeenCalledWith(ConnectionEntity, {
            select: { id: true },
            where: { id: "c1", workspaceId: "w1" },
            lock: { mode: "pessimistic_read" },
        })
    })

    it("is false when it does not", async () => {
        const handed = mockEntityManager({ findOne: [ConnectionEntity, null] })
        const service = await build(mockEntityManager())

        await expect(service.holds("w1", "c9", handed)).resolves.toBe(false)
    })
})
