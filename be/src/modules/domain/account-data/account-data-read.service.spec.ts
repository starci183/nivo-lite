import { Test } from "@nestjs/testing"
import { mock, mockEntityManager, queueQueryBuilders } from "@starci/jest-preset"
import type { MockEntityManager, QueryBuilderAnswers } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER, type Logger } from "@modules/platform/logging"
import type { AccountDataTypeDef } from "./account-data.contracts"
import { ACCOUNT_DATA_OPTIONS } from "./account-data.port"
import { AccountDataReadService } from "./account-data-read.service"
import { AccountDataTypesService } from "./account-data-types.service"
import { AccountDataErrorCode } from "./errors/account-data.error"
import { AccountDataEntity } from "./persistence/entities"

const CONNECTION = "0b8e6f4a-6c1e-4d47-9a51-1f3c2b7d9e10"

const message: AccountDataTypeDef = {
    name: "telegram.message",
    provider: "telegram",
    version: 1,
    write: "append",
    fields: {
        chatId: { type: "text", required: true },
        messageId: { type: "integer", required: true },
        username: { type: "text", required: false },
        bot: { type: "boolean", required: false },
    },
    key: ["chatId", "messageId"],
    retention: "keep",
    indexes: [
        { name: "username", on: ["username"] },
        { name: "message", on: ["messageId", "chatId"] },
        { name: "bot", on: ["bot"] },
    ],
    purpose: "chat.message",
}
const snapshot: AccountDataTypeDef = {
    name: "interface.snapshot",
    provider: null,
    version: 1,
    write: "overwrite",
    fields: { verb: { type: "text", required: true } },
    key: ["verb"],
    ttlMs: 60_000,
    retention: "keep",
}

const TYPE_AND_CONNECTION = "r.type = :type AND r.connection_id = :connectionId"
const CREATED_AT_UTC = `to_char(r.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`
const TTL = "r.occurred_at > now() - make_interval(secs => CAST(:ttlSeconds AS double precision))"

const entity = (overrides: Partial<AccountDataEntity> = {}): AccountDataEntity =>
    Object.assign(new AccountDataEntity(), {
        type: "telegram.message",
        id: "row-1",
        typeVersion: 1,
        provider: "telegram",
        connectionId: CONNECTION,
        workspaceId: "ws-1",
        key: "-100:7",
        value: { chatId: "-100", messageId: 7 },
        occurredAt: new Date("2026-11-12T00:00:00Z"),
        processedAt: null,
        ...overrides,
    })

const STORED = {
    id: "row-1",
    type: "telegram.message",
    typeVersion: 1,
    key: "-100:7",
    value: { chatId: "-100", messageId: 7 },
    occurredAt: new Date("2026-11-12T00:00:00Z"),
    processedAt: null,
}

const build = async (...answers: Array<QueryBuilderAnswers>) => {
    const em: MockEntityManager = mockEntityManager()
    const fakes = queueQueryBuilders(em, answers)
    const moduleRef = await Test.createTestingModule({
        providers: [
            AccountDataReadService,
            AccountDataTypesService,
            { provide: ACCOUNT_DATA_OPTIONS, useValue: { types: [message, snapshot] } },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: LOGGER, useValue: mock<Logger>() },
        ],
    }).compile()
    return { reads: moduleRef.get(AccountDataReadService), em, fakes }
}

describe("AccountDataReadService.get", () => {
    it("reads the row of the type under the key, on the type's partition and the connection", async () => {
        const { reads, em, fakes } = await build({ getOne: entity() })

        await expect(reads.get(CONNECTION, "telegram.message", "-100:7")).resolves.toEqual(STORED)
        expect(em.createQueryBuilder).toHaveBeenCalledWith(AccountDataEntity, "r")
        expect(fakes[0]?.callsOf("where")).toEqual([
            [TYPE_AND_CONNECTION, { type: "telegram.message", connectionId: CONNECTION }],
        ])
        expect(fakes[0]?.callsOf("andWhere")).toEqual([["r.key = :key", { key: "-100:7" }]])
    })

    it("honours the type's ttl on the database clock: an expired row reads as absent", async () => {
        const { reads, fakes } = await build({ getOne: null })

        await expect(reads.get(CONNECTION, "interface.snapshot", "v:h")).resolves.toBeNull()
        expect(fakes[0]?.callsOf("andWhere")).toEqual([
            [TTL, { ttlSeconds: 60 }],
            ["r.key = :key", { key: "v:h" }],
        ])
    })

    it("reads on the handed manager when one is given", async () => {
        const { reads, em } = await build()
        const tx = mockEntityManager()
        queueQueryBuilders(tx, [{ getOne: null }])

        await reads.get(CONNECTION, "telegram.message", "-100:7", tx)

        expect(tx.createQueryBuilder).toHaveBeenCalledWith(AccountDataEntity, "r")
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })

    it("refuses an undeclared type (TYPE_UNDECLARED)", async () => {
        const { reads } = await build()

        await expect(reads.get(CONNECTION, "telegram.nope", "1")).rejects.toMatchObject({
            code: AccountDataErrorCode.TypeUndeclared,
        })
    })
})

describe("AccountDataReadService.newest", () => {
    it("reads the newest rows first, at most 200", async () => {
        const { reads, fakes } = await build({ getMany: [entity()] })

        await expect(reads.newest(CONNECTION, "telegram.message", 500)).resolves.toEqual([STORED])
        expect(fakes[0]?.callsOf("orderBy")).toEqual([["r.occurred_at", "DESC"]])
        expect(fakes[0]?.callsOf("limit")).toEqual([[200]])
    })

    it("honours the ttl", async () => {
        const { reads, fakes } = await build({ getMany: [] })

        await reads.newest(CONNECTION, "interface.snapshot", 5)

        expect(fakes[0]?.callsOf("andWhere")).toEqual([[TTL, { ttlSeconds: 60 }]])
    })
})

describe("AccountDataReadService.newestWhere", () => {
    it("reads the newest row whose member equals the value, on the member's index expression", async () => {
        const { reads, fakes } = await build({ getOne: entity() })

        await expect(reads.newestWhere(CONNECTION, "telegram.message", "username", "lan")).resolves.toEqual(STORED)
        expect(fakes[0]?.callsOf("andWhere")).toEqual([["(r.value ->> 'username') = :equals", { equals: "lan" }]])
        expect(fakes[0]?.callsOf("limit")).toEqual([[1]])
    })

    it("compares a boolean member by its text form, cast as its index does", async () => {
        const { reads, fakes } = await build({ getOne: null })

        await reads.newestWhere(CONNECTION, "telegram.message", "bot", true)

        expect(fakes[0]?.callsOf("andWhere")).toEqual([
            ["CAST((r.value ->> 'bot') AS boolean) = :equals", { equals: "true" }],
        ])
    })

    it("casts an integer member as its index does", async () => {
        const { reads, fakes } = await build({ getOne: null })

        await expect(reads.newestWhere(CONNECTION, "telegram.message", "messageId", 7)).resolves.toBeNull()
        expect(fakes[0]?.callsOf("andWhere")).toEqual([
            ["CAST((r.value ->> 'messageId') AS bigint) = :equals", { equals: "7" }],
        ])
    })

    it("refuses a member that is not the first member of a declared index (INDEX_UNDECLARED)", async () => {
        const { reads, em } = await build()

        await expect(reads.newestWhere(CONNECTION, "telegram.message", "chatId", "-100")).rejects.toMatchObject({
            code: AccountDataErrorCode.IndexUndeclared,
        })
        await expect(reads.newestWhere(CONNECTION, "interface.snapshot", "verb", "x")).rejects.toMatchObject({
            code: AccountDataErrorCode.IndexUndeclared,
        })
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })
})

describe("AccountDataReadService.newestWhereAlso", () => {
    it("narrows the same index read by a second declared member, so one kind of row alone answers", async () => {
        const { reads, fakes } = await build({ getOne: entity() })

        await expect(
            reads.newestWhereAlso(CONNECTION, "telegram.message", "username", "lan", { field: "bot", equals: false }),
        ).resolves.toEqual(STORED)
        expect(fakes[0]?.callsOf("andWhere")).toEqual([
            ["(r.value ->> 'username') = :equals", { equals: "lan" }],
            ["CAST((r.value ->> 'bot') AS boolean) = :alsoEquals", { alsoEquals: "false" }],
        ])
        expect(fakes[0]?.callsOf("orderBy")).toEqual([["r.occurred_at", "DESC"]])
        expect(fakes[0]?.callsOf("limit")).toEqual([[1]])
    })

    it("refuses a second member the type does not declare, and a first that is no index (INDEX_UNDECLARED), reading nothing", async () => {
        const { reads, em } = await build()

        await expect(
            reads.newestWhereAlso(CONNECTION, "telegram.message", "username", "lan", { field: "nope", equals: "x" }),
        ).rejects.toMatchObject({ code: AccountDataErrorCode.IndexUndeclared })
        await expect(
            reads.newestWhereAlso(CONNECTION, "telegram.message", "chatId", "-100", { field: "bot", equals: true }),
        ).rejects.toMatchObject({ code: AccountDataErrorCode.IndexUndeclared })
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })
})

describe("AccountDataReadService.after", () => {
    const raw = {
        id: "row-2",
        type: "telegram.message",
        typeVersion: 1,
        key: "-100:8",
        value: { chatId: "-100", messageId: 8 },
        occurredAt: new Date("2026-11-12T00:00:00Z"),
        processedAt: null,
        createdAt: "2026-11-12T00:00:00.123456Z",
    }

    it("reads the rows in the order they entered the store, after the point", async () => {
        const { reads, fakes } = await build({ getRawMany: [raw] })

        await expect(
            reads.after(CONNECTION, "telegram.message", { createdAt: "2026-11-11 00:00:00.5+00", id: "row-1" }, 50),
        ).resolves.toEqual([raw])
        expect(fakes[0]?.callsOf("orderBy")).toEqual([["r.created_at", "ASC"]])
        expect(fakes[0]?.callsOf("addOrderBy")).toEqual([["r.id", "ASC"]])
        expect(fakes[0]?.callsOf("andWhere")).toEqual([
            [
                "(r.created_at, r.id) > (CAST(:afterAt AS timestamptz), CAST(:afterId AS uuid))",
                { afterAt: "2026-11-11 00:00:00.5+00", afterId: "row-1" },
            ],
        ])
        expect(fakes[0]?.callsOf("addSelect")).toContainEqual([CREATED_AT_UTC, "createdAt"])
    })

    it("reads from the first row without a point", async () => {
        const { reads, fakes } = await build({ getRawMany: [] })

        await expect(reads.after(CONNECTION, "telegram.message", null, 10)).resolves.toEqual([])
        expect(fakes[0]?.callsOf("andWhere")).toEqual([])
    })
})

describe("AccountDataReadService.statsOf", () => {
    it("counts the account's rows per type with the newest time and each type's purpose, by type name", async () => {
        const newest = new Date("2026-11-12T03:00:00Z")
        const { reads, fakes } = await build({
            getRawMany: [
                { type: "telegram.message", rows: "12", newestAt: newest },
                { type: "interface.snapshot", rows: "2", newestAt: newest },
                { type: "telegram.gone", rows: "1", newestAt: null },
            ],
        })

        await expect(reads.statsOf(CONNECTION)).resolves.toEqual({
            types: [
                { type: "interface.snapshot", purpose: null, rows: 2, newestAt: newest },
                { type: "telegram.gone", purpose: null, rows: 1, newestAt: null },
                { type: "telegram.message", purpose: "chat.message", rows: 12, newestAt: newest },
            ],
        })
        expect(fakes[0]?.callsOf("groupBy")).toEqual([["r.type"]])
    })
})

describe("AccountDataReadService.byId", () => {
    const raw = {
        id: "row-1",
        type: "telegram.message",
        typeVersion: 1,
        key: "-100:7",
        value: { chatId: "-100", messageId: 7 },
        occurredAt: new Date("2026-11-12T00:00:00Z"),
        processedAt: null,
        createdAt: "2026-11-12T00:00:00.123000Z",
        connectionId: CONNECTION,
    }

    it("reads the row of the type by its id, whatever its connection, with its connection and fixed-width UTC entry", async () => {
        const { reads, fakes } = await build({ getRawMany: [raw] })

        await expect(reads.byId("telegram.message", "row-1")).resolves.toEqual(raw)
        expect(fakes[0]?.callsOf("where")).toEqual([
            ["r.type = :type AND r.id = :id", { type: "telegram.message", id: "row-1" }],
        ])
        expect(fakes[0]?.callsOf("addSelect")).toContainEqual(["r.connection_id", "connectionId"])
        expect(fakes[0]?.callsOf("addSelect")).toContainEqual([CREATED_AT_UTC, "createdAt"])
        expect(fakes[0]?.callsOf("limit")).toEqual([[1]])
    })

    it("answers null when there is none, honouring the ttl, on the handed manager", async () => {
        const { reads, em } = await build()
        const tx = mockEntityManager()
        const [query] = queueQueryBuilders(tx, [{ getRawMany: [] }])

        await expect(reads.byId("interface.snapshot", "row-9", tx)).resolves.toBeNull()
        expect(query?.callsOf("andWhere")).toEqual([[TTL, { ttlSeconds: 60 }]])
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })
})
