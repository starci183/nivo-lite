import { Test } from "@nestjs/testing"
import { mock, mockEntityManager, queueQueryBuilders } from "@starci/jest-preset"
import type { MockEntityManager, QueryBuilderAnswers } from "@starci/jest-preset"
import { evaluatedValues } from "@tests/fixtures/builders/evaluated-calls.builder"
import { ConnectionBindingsReadService } from "@modules/domain/connections"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER, type Logger } from "@modules/platform/logging"
import type { AccountDataTypeDef } from "./account-data.contracts"
import { ACCOUNT_DATA_OPTIONS } from "./account-data.port"
import { AccountCursorsService } from "./account-cursors.service"
import { AccountDataTypesService } from "./account-data-types.service"
import { AccountDataErrorCode } from "./errors/account-data.error"
import { AccountDataEntity } from "./persistence/entities"

const CONNECTION = "0b8e6f4a-6c1e-4d47-9a51-1f3c2b7d9e10"

const readCursor: AccountDataTypeDef = {
    name: "imap.read-cursor",
    provider: "imap",
    version: 2,
    write: "advance",
    fields: { agentId: { type: "text", required: true }, seenThrough: { type: "text", required: true } },
    key: ["agentId"],
    position: "seenThrough",
    retention: "keep",
}
const syncCursor: AccountDataTypeDef = {
    name: "imap.sync-cursor",
    provider: "imap",
    version: 1,
    write: "advance",
    fields: {
        folder: { type: "text", required: true },
        uid: { type: "integer", required: true },
        at: { type: "timestamp", required: true },
    },
    key: ["folder"],
    position: "uid",
    occurredAt: "at",
    retention: "keep",
}
const mail: AccountDataTypeDef = {
    name: "imap.mail",
    provider: "imap",
    version: 1,
    write: "append",
    fields: { id: { type: "text", required: true } },
    key: ["id"],
    retention: "keep",
}

const IMAP = { workspaceId: "ws-1", provider: "imap" }
const WHERE_ROW = "type = :type AND connection_id = :connectionId AND key = :key"

/** A database whose statements answer in order; the cursor's row is shared, so a compare-and-set sees the move before it. */
const build = async (
    account: { workspaceId: string; provider: string } | null,
    ...answers: Array<QueryBuilderAnswers>
) => {
    const bindings = mock<ConnectionBindingsReadService>()
    bindings.accountOf.mockResolvedValue(account)
    const em: MockEntityManager = mockEntityManager()
    const fakes = queueQueryBuilders(em, answers)
    const moduleRef = await Test.createTestingModule({
        providers: [
            AccountCursorsService,
            AccountDataTypesService,
            { provide: ACCOUNT_DATA_OPTIONS, useValue: { types: [readCursor, syncCursor, mail] } },
            { provide: ConnectionBindingsReadService, useValue: bindings },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: LOGGER, useValue: mock<Logger>() },
        ],
    }).compile()
    return { cursors: moduleRef.get(AccountCursorsService), em, fakes, bindings }
}

describe("AccountCursorsService.advance", () => {
    it("a first advance with expected null creates the row once: the second insert-or-ignore answers no row", async () => {
        const { cursors, fakes } = await build(IMAP, { execute: { raw: [{ id: "cur-1" }] } }, { execute: { raw: [] } })
        const value = { agentId: "a1", seenThrough: "2026-11-12 00:00:00+00~r1" }

        await expect(cursors.advance(CONNECTION, "imap.read-cursor", null, value)).resolves.toBe(true)
        await expect(cursors.advance(CONNECTION, "imap.read-cursor", null, value)).resolves.toBe(false)
        expect(fakes[0]?.callsOf("values")).toEqual([
            [
                {
                    type: "imap.read-cursor",
                    typeVersion: 2,
                    provider: "imap",
                    connectionId: CONNECTION,
                    workspaceId: "ws-1",
                    key: "a1",
                    value,
                },
            ],
        ])
        expect(fakes[0]?.callsOf("orIgnore")).toEqual([[]])
    })

    it("of two advances from the same expected position one wins: ONE compare-and-set statement each", async () => {
        // The database is modelled by a fake: the first UPDATE … WHERE value ->> 'seenThrough' = :expected changes the row, the
        // second finds the position already moved and changes none. The atomicity is the single statement, proven only on a real database.
        const { cursors, fakes } = await build(IMAP, { execute: { affected: 1 } }, { execute: { affected: 0 } })

        const results = await Promise.all([
            cursors.advance(CONNECTION, "imap.read-cursor", "b", { agentId: "a1", seenThrough: "c" }),
            cursors.advance(CONNECTION, "imap.read-cursor", "b", { agentId: "a1", seenThrough: "d" }),
        ])

        expect(results.filter((won) => won)).toHaveLength(1)
        expect(fakes[0]?.callsOf("where")).toEqual([
            [WHERE_ROW, { type: "imap.read-cursor", connectionId: CONNECTION, key: "a1" }],
        ])
        expect(fakes[0]?.callsOf("andWhere")).toEqual([["value ->> 'seenThrough' = :expected", { expected: "b" }]])
        expect(evaluatedValues(fakes[0]?.callsOf("set")[0]?.[0])).toEqual({
            value: { agentId: "a1", seenThrough: "c" },
            typeVersion: 2,
            occurredAt: "now()",
        })
    })
})

describe("AccountCursorsService.advance refusals and managers", () => {
    it("refuses a backward or equal position without asking the database", async () => {
        const { cursors, em } = await build(IMAP)

        await expect(
            cursors.advance(CONNECTION, "imap.read-cursor", "b", { agentId: "a1", seenThrough: "a" }),
        ).resolves.toBe(false)
        await expect(
            cursors.advance(CONNECTION, "imap.read-cursor", "b", { agentId: "a1", seenThrough: "b" }),
        ).resolves.toBe(false)
        await expect(
            cursors.advance(CONNECTION, "imap.sync-cursor", 10, {
                folder: "INBOX",
                uid: 9,
                at: "2026-11-12T00:00:00Z",
            }),
        ).resolves.toBe(false)
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })

    it("compares an integer position numerically and writes the value's declared time", async () => {
        const { cursors, fakes } = await build(IMAP, { execute: { affected: 1 } })

        await expect(
            cursors.advance(CONNECTION, "imap.sync-cursor", 9, {
                folder: "INBOX",
                uid: 10,
                at: "2026-11-12T00:00:00Z",
            }),
        ).resolves.toBe(true)
        expect(fakes[0]?.callsOf("andWhere")).toEqual([["value ->> 'uid' = :expected", { expected: "9" }]])
        expect(fakes[0]?.callsOf("set")[0]?.[0]).toMatchObject({ occurredAt: new Date("2026-11-12T00:00:00Z") })
    })

    it("moves the row on the handed manager when one is given", async () => {
        const { cursors, em, bindings } = await build(IMAP)
        const tx = mockEntityManager()
        queueQueryBuilders(tx, [{ execute: { affected: 1 } }])

        await expect(
            cursors.advance(CONNECTION, "imap.read-cursor", "a", { agentId: "a1", seenThrough: "b" }, tx),
        ).resolves.toBe(true)
        expect(bindings.accountOf).toHaveBeenCalledWith(CONNECTION, tx)
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })

    it("answers false for a connection nobody holds or a text that is no connection id", async () => {
        const { cursors, bindings } = await build(null)

        await expect(
            cursors.advance(CONNECTION, "imap.read-cursor", null, { agentId: "a1", seenThrough: "a" }),
        ).resolves.toBe(false)
        await expect(
            cursors.advance("nope", "imap.read-cursor", null, { agentId: "a1", seenThrough: "a" }),
        ).resolves.toBe(false)
        expect(bindings.accountOf).toHaveBeenCalledTimes(1)
    })

    it("refuses a type that is not advance (WRITE_MODE), another provider's type, and an invalid value", async () => {
        const { cursors } = await build(IMAP)

        await expect(cursors.advance(CONNECTION, "imap.mail", null, { id: "1" })).rejects.toMatchObject({
            code: AccountDataErrorCode.WriteMode,
        })
        await expect(
            cursors.advance(CONNECTION, "imap.read-cursor", null, { agentId: "a1", seenThrough: 5 }),
        ).rejects.toMatchObject({ code: AccountDataErrorCode.ValueInvalid })
        const zalo = await build({ workspaceId: "ws-1", provider: "zalo_oa" })
        await expect(
            zalo.cursors.advance(CONNECTION, "imap.read-cursor", null, { agentId: "a1", seenThrough: "a" }),
        ).rejects.toMatchObject({ code: AccountDataErrorCode.TypeUndeclared })
    })
})

describe("AccountCursorsService.read", () => {
    it("reads the position row under the key", async () => {
        const { cursors, em } = await build(IMAP)
        const row = Object.assign(new AccountDataEntity(), {
            type: "imap.read-cursor",
            id: "cur-1",
            typeVersion: 2,
            key: "a1",
            value: { agentId: "a1", seenThrough: "b" },
            occurredAt: new Date("2026-11-12T00:00:00Z"),
            processedAt: null,
        })
        em.findOne.mockResolvedValue(row)

        await expect(cursors.read(CONNECTION, "imap.read-cursor", "a1")).resolves.toEqual({
            id: "cur-1",
            type: "imap.read-cursor",
            typeVersion: 2,
            key: "a1",
            value: { agentId: "a1", seenThrough: "b" },
            occurredAt: new Date("2026-11-12T00:00:00Z"),
            processedAt: null,
        })
        expect(em.findOne).toHaveBeenCalledWith(AccountDataEntity, {
            where: { type: "imap.read-cursor", connectionId: CONNECTION, key: "a1" },
        })
    })

    it("answers null when there is no row yet, reading on the handed manager", async () => {
        const { cursors } = await build(IMAP)
        const tx = mockEntityManager({ findOne: [AccountDataEntity, null] })

        await expect(cursors.read(CONNECTION, "imap.read-cursor", "a1", tx)).resolves.toBeNull()
    })

    it("refuses a type that is not advance", async () => {
        const { cursors } = await build(IMAP)

        await expect(cursors.read(CONNECTION, "imap.mail", "1")).rejects.toMatchObject({
            code: AccountDataErrorCode.WriteMode,
        })
    })
})
