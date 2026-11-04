import { Test } from "@nestjs/testing"
import {
    botConnectionOf,
    liveBotConnectionOf,
    numericUsernameConnectionOf,
} from "@tests/fixtures/builders/connections.builder"
import { ROW } from "@tests/fixtures/builders/connections.builder"
import { mockEntityManager, queueQueryBuilders } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { In, Not } from "typeorm"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ConnectionBindingsReadService } from "./connection-bindings-read.service"
import { ConnectionEntity } from "./persistence/entities"

const build = async (em: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [ConnectionBindingsReadService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return moduleRef.get(ConnectionBindingsReadService)
}

describe("ConnectionBindingsReadService > factsOf", () => {
    it("answers the facts of the connections, trimming the reported texts and dropping blank ones", async () => {
        const em = mockEntityManager({ find: [ConnectionEntity, [botConnectionOf()]] })

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
        const em = mockEntityManager({ find: [ConnectionEntity, [numericUsernameConnectionOf()]] })

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

describe("ConnectionBindingsReadService > ofProvider", () => {
    it("lists the connections of a workspace under one provider, oldest first, with the status facts", async () => {
        const stored = {
            ...botConnectionOf(),
            lastError: "invalid_grant",
            publicMeta: { bot_username: "shop_bot", oa_id: " 123 ", email: "lan@shop.vn" },
        }
        const em = mockEntityManager({ find: [ConnectionEntity, [stored]] })

        await expect((await build(em)).ofProvider("ws-1", "telegram", 20)).resolves.toEqual([
            {
                id: "c1",
                provider: "telegram",
                name: "Shop bot",
                status: "connected",
                createdAt: new Date("2026-10-01T00:00:00.000Z"),
                botUsername: "shop_bot",
                accountMasked: null,
                lastError: "invalid_grant",
                oaId: "123",
                email: "lan@shop.vn",
            },
        ])
        expect(em.find).toHaveBeenCalledWith(ConnectionEntity, {
            select: {
                id: true,
                provider: true,
                name: true,
                status: true,
                createdAt: true,
                publicMeta: true,
                lastError: true,
            },
            where: { workspaceId: "ws-1", provider: "telegram" },
            order: { createdAt: "ASC", id: "ASC" },
            take: 20,
        })
    })

    it("answers no connection when the workspace has none under the provider", async () => {
        const em = mockEntityManager({ find: [ConnectionEntity, []] })

        await expect((await build(em)).ofProvider("ws-1", "zalo_oa", 20)).resolves.toEqual([])
    })
})

describe("ConnectionBindingsReadService > holds", () => {
    it("is true when the workspace holds the connection, read under a shared lock", async () => {
        const handed = mockEntityManager({ findOne: [ConnectionEntity, botConnectionOf()] })
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

describe("ConnectionBindingsReadService > owner and state", () => {
    it("answers the workspace and the state of the connection", async () => {
        const handed = mockEntityManager({
            findOne: [ConnectionEntity, liveBotConnectionOf()],
        })
        const service = await build(mockEntityManager())

        await expect(service.workspaceOf("c1", handed)).resolves.toBe("w1")
        await expect(service.stateOf("c1", handed)).resolves.toEqual({ name: "Shop bot", environment: "live" })
    })

    it("answers null for a connection that does not exist", async () => {
        const handed = mockEntityManager({ findOne: [ConnectionEntity, null] })
        const service = await build(mockEntityManager())

        await expect(service.workspaceOf("c9", handed)).resolves.toBeNull()
        await expect(service.stateOf("c9", handed)).resolves.toBeNull()
    })
})

describe("ConnectionBindingsReadService > recordOf", () => {
    it("answers the connection of the workspace as its record, read by workspace and id", async () => {
        const em = mockEntityManager()
        const [query] = queueQueryBuilders(em, [{ getRawOne: ROW }])

        await expect((await build(em)).recordOf("ws-1", "c1")).resolves.toEqual({
            id: "c1",
            workspaceId: "ws-1",
            provider: "sepay",
            name: "Bank",
            meta: {},
            status: "pending",
            lastError: null,
            environment: "live",
            isDefault: false,
            lastEventAt: null,
            firstEvent: null,
            createdBy: "user-1",
            createdAt: "2026-10-01T00:00:00.000Z",
        })
        expect(query?.callsOf("where")).toEqual([
            ["c.workspaceId = :workspaceId AND c.id = :id", { workspaceId: "ws-1", id: "c1" }],
        ])
        expect(query?.callsOf("limit")).toEqual([[1]])
    })

    it("answers null when the workspace holds no such connection", async () => {
        const em = mockEntityManager()
        queueQueryBuilders(em, [{ getRawOne: undefined }])

        await expect((await build(em)).recordOf("ws-1", "c9")).resolves.toBeNull()
    })
})

describe("ConnectionBindingsReadService > feedAccountsOf", () => {
    it("lists the live feeds of a workspace under one provider, newest first, with the account each reported", async () => {
        const feed = {
            ...botConnectionOf({ id: "f1", provider: "sepay" }),
            publicMeta: { account_number: " 0123456789 ", bank_code: "VCB", account_holder: "   " },
        }
        const em = mockEntityManager({ find: [ConnectionEntity, [feed]] })

        await expect((await build(em)).feedAccountsOf("ws-1", "sepay", 3)).resolves.toEqual([
            {
                id: "f1",
                provider: "sepay",
                status: "connected",
                createdAt: new Date("2026-10-01T00:00:00.000Z"),
                accountNumber: "0123456789",
                bankCode: "VCB",
                accountHolder: null,
            },
        ])
        expect(em.find).toHaveBeenCalledWith(ConnectionEntity, {
            select: { id: true, provider: true, status: true, createdAt: true, publicMeta: true },
            where: { workspaceId: "ws-1", provider: "sepay", status: Not("disconnected") },
            order: { createdAt: "DESC", id: "DESC" },
            take: 3,
        })
    })
})
