import { Test } from "@nestjs/testing"
import { fakeTransaction, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { In, Not } from "typeorm"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { connectionsCase } from "@tests/fixtures/builders/connections.builder"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder.builder"
import type { FakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder.builder"
import { namedCalls, stampedValues } from "@tests/fixtures/builders/entity-row.builder"
import { ConnectionsUpkeepService } from "./connections-upkeep.service"
import { ConnectionEntity } from "./persistence/entities"

const { missing } = connectionsCase
const AT = "2026-10-12T10:00:00.000Z"

const build = async (em: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [ConnectionsUpkeepService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return moduleRef.get(ConnectionsUpkeepService)
}
const withBuilders = (
    answers: Parameters<typeof queueQueryBuilders>[1],
    em: MockEntityManager = mockEntityManager(),
) => ({
    em,
    fakes: queueQueryBuilders(em, answers),
})
const setOf = (fake: FakeQueryBuilder | undefined) => stampedValues(fake?.callsOf("set")[0]?.[0])

describe("ConnectionsUpkeepService > health", () => {
    it("reads a page after an id, from the start when none is given", async () => {
        const candidate = {
            id: "c-1",
            workspaceId: "ws-1",
            provider: "telegram",
            name: "Bot",
            status: "connected",
            lastError: "",
            lastEventAt: "2026-10-10",
            createdAt: "2026-10-01",
            health: "ok",
        }
        const { em, fakes } = withBuilders([{ getRawMany: [candidate] }, { getRawMany: [] }])
        const service = await build(em)
        await expect(service.healthBatch("", 100)).resolves.toEqual([candidate])
        await expect(service.healthBatch("c-1", 50)).resolves.toEqual([])
        expect(fakes[0]?.callsOf("where")[0]?.[1]).toEqual({ afterId: "00000000-0000-0000-0000-000000000000" })
        expect(fakes[0]?.callsOf("limit")).toEqual([[100]])
        expect(fakes[1]?.callsOf("where")[0]?.[1]).toEqual({ afterId: "c-1" })
        expect(fakes[1]?.callsOf("orderBy")).toEqual([["c.id"]])
    })

    it("records the verdict in the public facts", async () => {
        const { em, fakes } = withBuilders([{ execute: {} }])
        const mark = { state: "silent" as const, reason: "no event for 80h", checkedAt: AT }
        await (await build(em)).markHealth("c-1", mark)
        expect(fakes[0]?.callsOf("setParameter")).toEqual([
            ["verdict", '{"state":"silent","reason":"no event for 80h","checked_at":"2026-10-12T10:00:00.000Z"}'],
        ])
        expect(fakes[0]?.callsOf("where")).toEqual([[{ id: "c-1" }]])
    })
})

describe("ConnectionsUpkeepService > sync scheduling and default SMTP", () => {
    it("reads timed and manual schedules and rejects a missing connection", async () => {
        const { em, fakes } = withBuilders([
            { getRawOne: { everyMinutes: 15, lastSyncAt: AT } },
            { getRawOne: { everyMinutes: null, lastSyncAt: null } },
            { getRawOne: undefined },
        ])
        const service = await build(em)
        await expect(service.scheduleOf("ws-1", "c1")).resolves.toEqual({ everyMinutes: 15, lastSyncAt: AT })
        await expect(service.scheduleOf("ws-1", "c2")).resolves.toEqual({ everyMinutes: null, lastSyncAt: null })
        await expect(service.scheduleOf("ws-1", "c9")).rejects.toMatchObject({ ...missing, params: { id: "c9" } })
        expect(fakes[2]?.callsOf("where")).toEqual([
            ["c.workspaceId = :workspaceId AND c.id = :id", { workspaceId: "ws-1", id: "c9" }],
        ])
    })

    it.each([15, null] as const)("sets the sync interval to %s", async (everyMinutes) => {
        const { em, fakes } = withBuilders([{ execute: { raw: [{ id: "c1" }] } }])
        await expect((await build(em)).setSchedule("ws-1", "c1", everyMinutes)).resolves.toBeUndefined()
        expect(fakes[0]?.callsOf("setParameter")).toEqual([["minutes", everyMinutes]])
        expect(fakes[0]?.callsOf("where")).toEqual([[{ workspaceId: "ws-1", id: "c1" }]])
        expect(setOf(fakes[0])).toEqual({ syncEveryMinutes: "function", nextSyncAt: "function", updatedAt: "function" })
    })

    it("rejects a missing connection when setting its schedule", async () => {
        const { em } = withBuilders([{ execute: { raw: [] } }])
        await expect((await build(em)).setSchedule("ws-1", "c9", 15)).rejects.toMatchObject({
            ...missing,
            params: { id: "c9" },
        })
    })

    it("writes sync facts, sync errors and the workspace default SMTP", async () => {
        const em = mockEntityManager({ update: [ConnectionEntity, { affected: 1 }] })
        const { fakes } = withBuilders([{ execute: {} }, { execute: {} }], em)
        const service = await build(em)
        await expect(service.markSynced("c1", { items: "3", cursor: "next" })).resolves.toBeUndefined()
        await expect(service.markSyncFailed("c2", "Expired token")).resolves.toBeUndefined()
        await expect(service.setDefaultSmtp("ws-1", "c3")).resolves.toBeUndefined()
        expect(fakes[0]?.callsOf("setParameter")).toEqual([["facts", '{"items":"3","cursor":"next"}']])
        expect(setOf(fakes[0])).toMatchObject({ status: "connected", lastError: null, lastSyncAt: "function" })
        expect(namedCalls(em.update.mock.calls, 2)).toEqual([
            [
                "ConnectionEntity",
                { id: "c2" },
                { status: "error", lastError: "Expired token", nextSyncAt: "function", updatedAt: "function" },
            ],
        ])
        expect(setOf(fakes[1])).toEqual({ isDefault: "function", updatedAt: "function" })
        expect(fakes[1]?.callsOf("where")).toEqual([
            [
                "workspace_id = :workspaceId AND provider = 'smtp' AND (is_default OR id = :id)",
                { workspaceId: "ws-1", id: "c3" },
            ],
        ])
    })

    it("claims the due sync owners under a skip-locked read and moves their next sync on", async () => {
        const tx = fakeTransaction(mockEntityManager())
        const { fakes } = withBuilders(
            [
                { getRawMany: [{ id: "c2" }, { id: "c1" }] },
                {
                    execute: {
                        raw: [
                            { id: "c2", workspace_id: "ws-2" },
                            { id: "c1", workspace_id: "ws-1" },
                        ],
                    },
                },
            ],
            tx.em,
        )
        await expect((await build(tx.em)).claimDueSyncs(["telegram", "smtp"], 2)).resolves.toEqual([
            { id: "c2", workspaceId: "ws-2" },
            { id: "c1", workspaceId: "ws-1" },
        ])
        expect(fakes[0]?.callsOf("setLock")).toEqual([["pessimistic_write"]])
        expect(fakes[0]?.callsOf("setOnLocked")).toEqual([["skip_locked"]])
        expect(fakes[0]?.callsOf("limit")).toEqual([[2]])
        expect(fakes[1]?.callsOf("where")).toEqual([[{ id: In(["c2", "c1"]) }]])
        expect(fakes[1]?.callsOf("returning")).toEqual([["id, workspace_id"]])
        expect(tx.commits).toBe(1)
    })

    it("claims nothing and writes nothing when no sync is due", async () => {
        const tx = fakeTransaction(mockEntityManager())
        withBuilders([{ getRawMany: [] }], tx.em)
        await expect((await build(tx.em)).claimDueSyncs([], 5)).resolves.toEqual([])
        expect(tx.em.createQueryBuilder).toHaveBeenCalledTimes(1)
    })

    it("answers the default SMTP id or null", async () => {
        const em = mockEntityManager({
            findOne: [
                [ConnectionEntity, Object.assign(new ConnectionEntity(), { id: "c3" })],
                [ConnectionEntity, null],
            ],
        })
        const service = await build(em)
        await expect(service.defaultSmtpId("ws-1")).resolves.toBe("c3")
        await expect(service.defaultSmtpId("ws-2")).resolves.toBeNull()
        expect(em.findOne.mock.calls[0]).toEqual([
            ConnectionEntity,
            {
                where: { workspaceId: "ws-1", provider: "smtp", isDefault: true, status: Not("disconnected") },
                select: { id: true },
            },
        ])
    })
})
