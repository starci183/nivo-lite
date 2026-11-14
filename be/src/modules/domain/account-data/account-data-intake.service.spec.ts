import { IsNull } from "typeorm"
import { Test } from "@nestjs/testing"
import { mock, mockEntityManager, queueQueryBuilders } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { evaluatedValues } from "@tests/fixtures/builders/evaluated-calls.builder"
import { ConnectionBindingsReadService } from "@modules/domain/connections"
import { LOGGER, type Logger } from "@modules/platform/logging"
import type { AccountDataTypeDef, PendingRow } from "./account-data.contracts"
import { AccountDataLogEvent } from "./account-data.log-events"
import { ACCOUNT_DATA_OPTIONS } from "./account-data.port"
import { AccountDataIntakeService } from "./account-data-intake.service"
import { AccountDataTypesService } from "./account-data-types.service"
import { AccountDataErrorCode } from "./errors/account-data.error"
import { AccountDataEntity } from "./persistence/entities"

const CONNECTION = "0b8e6f4a-6c1e-4d47-9a51-1f3c2b7d9e10"
const owner = { provider: "telegram", connectionId: CONNECTION, workspaceId: "ws-1" }

const update: AccountDataTypeDef = {
    name: "telegram.update",
    provider: "telegram",
    version: 1,
    write: "append",
    fields: { updateId: { type: "text", required: true }, raw: { type: "json", required: true } },
    key: ["updateId"],
    wakes: true,
    retention: { days: 30 },
    secretFields: ["bot_token"],
    maxBytes: 200,
}
const user: AccountDataTypeDef = {
    name: "telegram.user",
    provider: "telegram",
    version: 3,
    write: "overwrite",
    fields: { userId: { type: "integer", required: true }, username: { type: "text", required: false } },
    key: ["userId"],
    retention: "keep",
}
const cursor: AccountDataTypeDef = {
    name: "telegram.cursor",
    provider: "telegram",
    version: 1,
    write: "advance",
    fields: { botId: { type: "text", required: true }, offset: { type: "integer", required: true } },
    key: ["botId"],
    position: "offset",
    retention: "keep",
}
const zaloEvent: AccountDataTypeDef = { ...update, name: "zalo_oa.event", provider: "zalo_oa" }

/** The insert statements the spec's database answers, in order: the rows each `RETURNING` gives back. */
const build = async (account: { workspaceId: string; provider: string } | null, ...returned: Array<unknown>) => {
    const bindings = mock<ConnectionBindingsReadService>()
    bindings.accountOf.mockResolvedValue(account)
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            AccountDataIntakeService,
            AccountDataTypesService,
            { provide: ACCOUNT_DATA_OPTIONS, useValue: { types: [update, user, cursor, zaloEvent] } },
            { provide: ConnectionBindingsReadService, useValue: bindings },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    const tx: MockEntityManager = mockEntityManager()
    const fakes = queueQueryBuilders(
        tx,
        returned.map((raw) => ({ execute: { raw, affected: 0 } })),
    )
    return { intake: moduleRef.get(AccountDataIntakeService), bindings, logger, tx, fakes }
}

const ACCOUNT = { workspaceId: "ws-1", provider: "telegram" }
const updateRow = { type: "telegram.update", value: { updateId: "42", raw: { message: { text: "hi" } } } }

describe("AccountDataIntakeService.write", () => {
    it("writes a new append row of the account in the caller's transaction and answers it new", async () => {
        const { intake, bindings, tx, fakes } = await build(ACCOUNT, [{ id: "row-1" }])

        await expect(intake.write(tx, CONNECTION, [updateRow])).resolves.toEqual({
            owner,
            rows: [{ type: "telegram.update", key: "42", id: "row-1", isNew: true }],
        })

        expect(bindings.accountOf).toHaveBeenCalledWith(CONNECTION, tx)
        expect(tx.createQueryBuilder).toHaveBeenCalledWith(AccountDataEntity, "r")
        const [insert] = fakes
        expect(insert?.callsOf("values")).toEqual([
            [{ type: "telegram.update", typeVersion: 1, ...owner, key: "42", value: updateRow.value }],
        ])
        expect(insert?.callsOf("orIgnore")).toEqual([[]])
        expect(insert?.callsOf("returning")).toEqual([["id"]])
    })

    it("answers a redelivery not new, with no id (the insert-or-ignore returned no row)", async () => {
        const { intake, tx } = await build(ACCOUNT, [])

        await expect(intake.write(tx, CONNECTION, [updateRow])).resolves.toEqual({
            owner,
            rows: [{ type: "telegram.update", key: "42", id: "", isNew: false }],
        })
    })

    it("two pollers write the same provider key: exactly one gets isNew true", async () => {
        // The database's ON CONFLICT is modelled by a fake: the first insert returns its row, the second none. The atomicity itself
        // is the unique index (type, connection_id, key) + `ON CONFLICT DO NOTHING`, proven only against a real database.
        const { intake, tx } = await build(ACCOUNT, [{ id: "row-1" }], [])

        const [first, second] = await Promise.all([
            intake.write(tx, CONNECTION, [updateRow]),
            intake.write(tx, CONNECTION, [updateRow]),
        ])

        expect([first.rows[0]?.isNew, second.rows[0]?.isNew].filter((isNew) => isNew === true)).toHaveLength(1)
        expect([first.rows[0]?.key, second.rows[0]?.key]).toEqual(["42", "42"])
    })
})

describe("AccountDataIntakeService.claim", () => {
    const claim = { connectionId: CONNECTION, ...updateRow }

    it("answers the row of a new delivery, written in the caller's transaction", async () => {
        const { intake, bindings, tx } = await build(ACCOUNT, [{ id: "row-1" }])

        await expect(intake.claim(tx, claim)).resolves.toEqual({
            type: "telegram.update",
            key: "42",
            id: "row-1",
            isNew: true,
        })
        expect(bindings.accountOf).toHaveBeenCalledWith(CONNECTION, tx)
    })

    it("answers undefined for a repeat of a stored delivery", async () => {
        const { intake, tx } = await build(ACCOUNT, [])

        await expect(intake.claim(tx, claim)).resolves.toBeUndefined()
    })

    it("answers undefined and writes nothing when no account holds the connection", async () => {
        const { intake, tx } = await build(null)

        await expect(intake.claim(tx, claim)).resolves.toBeUndefined()
        expect(tx.createQueryBuilder).not.toHaveBeenCalled()
    })
})

describe("AccountDataIntakeService.write overwrite and order", () => {
    it("inserts a first overwrite row new, with no update", async () => {
        const { intake, tx, fakes } = await build(ACCOUNT, [{ id: "u-1" }])
        const row = { type: "telegram.user", value: { userId: 7, username: "lan" } }

        await expect(intake.write(tx, CONNECTION, [row])).resolves.toEqual({
            owner,
            rows: [{ type: "telegram.user", key: "7", id: "u-1", isNew: true }],
        })
        const [insert] = fakes
        expect(insert?.callsOf("values")).toEqual([
            [{ type: "telegram.user", typeVersion: 3, ...owner, key: "7", value: row.value }],
        ])
        expect(insert?.callsOf("orIgnore")).toEqual([[]])
        expect(insert?.callsOf("returning")).toEqual([["id"]])
        expect(tx.update).not.toHaveBeenCalled()
    })

    it("replaces value, version and time of a stored overwrite row by its key, on the database clock, and answers it not new", async () => {
        const { intake } = await build(ACCOUNT)
        const tx = mockEntityManager({ update: [AccountDataEntity, { affected: 1 }] })
        queueQueryBuilders(tx, [{ execute: { raw: [], affected: 0 } }])
        const row = { type: "telegram.user", value: { userId: 7, username: "minh" } }

        await expect(intake.write(tx, CONNECTION, [row])).resolves.toEqual({
            owner,
            rows: [{ type: "telegram.user", key: "7", id: "", isNew: false }],
        })
        expect(tx.update).toHaveBeenCalledTimes(1)
        const [[entity, where, changes] = []] = tx.update.mock.calls
        expect(entity).toBe(AccountDataEntity)
        expect(where).toEqual({ type: "telegram.user", connectionId: CONNECTION, key: "7" })
        expect(evaluatedValues(changes)).toEqual({ value: row.value, typeVersion: 3, occurredAt: "now()" })
    })

    it("writes a type of any provider when it names none, under the connection's provider", async () => {
        const { intake, tx } = await build({ workspaceId: "ws-1", provider: "zalo_oa" }, [{ id: "z-1" }])

        await expect(
            intake.write(tx, CONNECTION, [{ type: "zalo_oa.event", value: updateRow.value }]),
        ).resolves.toMatchObject({
            owner: { provider: "zalo_oa" },
            rows: [{ isNew: true }],
        })
    })

    it("writes the rows of one call in order and checks every row before writing any", async () => {
        const { intake, tx } = await build(ACCOUNT, [{ id: "row-1" }])

        await expect(
            intake.write(tx, CONNECTION, [updateRow, { type: "telegram.user", value: { userId: "seven" } }]),
        ).rejects.toMatchObject({ code: AccountDataErrorCode.ValueInvalid })

        expect(tx.createQueryBuilder).not.toHaveBeenCalled()
    })
})

describe("AccountDataIntakeService.write refusals", () => {
    it("refuses an undeclared type as a wiring error, thrown and logged with type and provider", async () => {
        const { intake, tx, logger } = await build(ACCOUNT)

        await expect(intake.write(tx, CONNECTION, [{ type: "telegram.nope", value: {} }])).rejects.toMatchObject({
            code: AccountDataErrorCode.TypeUndeclared,
            params: { type: "telegram.nope", provider: "telegram" },
        })
        expect(logger.error).toHaveBeenCalledWith(AccountDataLogEvent.WiringRefused, expect.anything(), {
            type: "telegram.nope",
            provider: "telegram",
        })
    })

    it("refuses another provider's type (TYPE_UNDECLARED)", async () => {
        const { intake, tx } = await build({ workspaceId: "ws-1", provider: "zalo_oa" })

        await expect(intake.write(tx, CONNECTION, [updateRow])).rejects.toMatchObject({
            code: AccountDataErrorCode.TypeUndeclared,
            params: { type: "telegram.update", provider: "zalo_oa" },
        })
    })

    it("refuses an advance type: its rows move only through the cursors (WRITE_MODE)", async () => {
        const { intake, tx } = await build(ACCOUNT)

        await expect(
            intake.write(tx, CONNECTION, [{ type: "telegram.cursor", value: { botId: "b", offset: 1 } }]),
        ).rejects.toMatchObject({ code: AccountDataErrorCode.WriteMode })
    })

    it.each<[string, object, AccountDataErrorCode]>([
        ["an invalid value", { updateId: 42, raw: {} }, AccountDataErrorCode.ValueInvalid],
        [
            "a secret member nested deep",
            { updateId: "42", raw: { a: [{ b: { bot_token: "1:x" } }] } },
            AccountDataErrorCode.SecretInValue,
        ],
        ["a value too large", { updateId: "42", raw: { text: "x".repeat(300) } }, AccountDataErrorCode.ValueTooLarge],
    ])("refuses %s and writes nothing", async (_case, value, code) => {
        const { intake, tx } = await build(ACCOUNT)

        await expect(intake.write(tx, CONNECTION, [{ type: "telegram.update", value }])).rejects.toMatchObject({ code })
        expect(tx.createQueryBuilder).not.toHaveBeenCalled()
    })

    it("keeps nothing for a connection nobody holds", async () => {
        const { intake, tx } = await build(null)

        await expect(intake.write(tx, CONNECTION, [updateRow])).resolves.toEqual({ owner: null, rows: [] })
        expect(tx.createQueryBuilder).not.toHaveBeenCalled()
    })

    it("keeps nothing for a text that is no connection id, without asking the database", async () => {
        const { intake, bindings, tx } = await build(ACCOUNT)

        await expect(intake.write(tx, "not-a-connection", [updateRow])).resolves.toEqual({ owner: null, rows: [] })
        expect(bindings.accountOf).not.toHaveBeenCalled()
    })
})

describe("AccountDataIntakeService.lockPending and complete", () => {
    const stored = (): AccountDataEntity =>
        Object.assign(new AccountDataEntity(), {
            type: "telegram.update",
            id: "row-1",
            typeVersion: 1,
            provider: "telegram",
            connectionId: CONNECTION,
            workspaceId: "ws-1",
            key: "42",
            value: { updateId: "42", raw: {} },
            occurredAt: new Date("2026-11-12T00:00:00Z"),
            processedAt: null,
        })
    const pending: PendingRow = {
        id: "row-1",
        type: "telegram.update",
        key: "42",
        owner,
        value: { updateId: "42", raw: {} },
    }

    it("locks the pending row of the type under the key FOR UPDATE", async () => {
        const { intake } = await build(ACCOUNT)
        const tx = mockEntityManager({ findOne: [AccountDataEntity, stored()] })

        await expect(intake.lockPending(tx, "telegram.update", CONNECTION, "42")).resolves.toEqual(pending)
        expect(tx.findOne).toHaveBeenCalledWith(AccountDataEntity, {
            where: { type: "telegram.update", connectionId: CONNECTION, key: "42", processedAt: IsNull() },
            lock: { mode: "pessimistic_write" },
        })
    })

    it("answers null when the row is absent or already completed", async () => {
        const { intake } = await build(ACCOUNT)
        const tx = mockEntityManager({ findOne: [AccountDataEntity, null] })

        await expect(intake.lockPending(tx, "telegram.update", CONNECTION, "42")).resolves.toBeNull()
    })

    it("refuses a type that never wakes, and an undeclared one", async () => {
        const { intake } = await build(ACCOUNT)
        const tx = mockEntityManager()

        await expect(intake.lockPending(tx, "telegram.user", CONNECTION, "7")).rejects.toMatchObject({
            code: AccountDataErrorCode.WriteMode,
        })
        await expect(intake.lockPending(tx, "telegram.nope", CONNECTION, "7")).rejects.toMatchObject({
            code: AccountDataErrorCode.TypeUndeclared,
        })
    })

    it("completes the row on the database clock, by its partition key", async () => {
        const { intake } = await build(ACCOUNT)
        const tx = mockEntityManager({ update: [AccountDataEntity, { affected: 1 }] })

        await intake.complete(tx, pending)

        const [[entity, where, changes] = []] = tx.update.mock.calls
        expect([entity, where]).toEqual([AccountDataEntity, { type: "telegram.update", id: "row-1" }])
        expect(evaluatedValues(changes)).toEqual({ processedAt: "now()" })
    })
})
