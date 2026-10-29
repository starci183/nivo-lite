import { randomBytes } from "node:crypto"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { Secret } from "@modules/platform/config"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { entityRowBuilder, namedCalls } from "@tests/fixtures/builders/entity-row.builder"
import { answerByTable } from "@tests/fixtures/builders/table-query-builder.builder"
import { CONNECTION_SECRETS_OPTIONS } from "./connection-secrets.decorators"
import { ConnectionSecretsService } from "./connection-secrets.service"
import { ConnectionSecretsErrorCode } from "./errors/connection-secrets.error"
import { ConnectionSecretEntity } from "./persistence/entities"
import { openSecret, sealSecret } from "./secret-cipher.policy"

const KEY = randomBytes(32)
const options = { tokenKey: new Secret(KEY.toString("base64")) }
const textLike: unknown = expect.stringContaining("Error")
const hex64: unknown = expect.stringMatching(/^[a-f0-9]{64}$/u)

/** A joined read of a connection and its sealed secret, as the query answers it. */
interface JoinedRead {
    /** The workspace of the connection. */
    readonly workspaceId: string
    /** The provider of the connection. */
    readonly provider: string
    /** The status of the connection. */
    readonly status: string
    /** The sealed credential. */
    readonly ciphertext: string
    /** The webhook secret. */
    readonly webhookSecret: string
    /** When the access token ends. */
    readonly tokenExpiresAt: Date | null
}

const readOf = entityRowBuilder<JoinedRead>({
    workspaceId: "ws-1",
    provider: "telegram",
    status: "connected",
    ciphertext: sealSecret(KEY, "123:token"),
    webhookSecret: "hook-secret",
    tokenExpiresAt: null,
})

/** One stored secret of a connection. */
const storedOf = entityRowBuilder<ConnectionSecretEntity>({
    connectionId: "c-1",
    ciphertext: sealSecret(KEY, "stored-token"),
    webhookSecret: "hook",
    tokenExpiresAt: null,
    refreshLockUntil: null,
})

const NOT_FOUND = { kind: "refused", code: ConnectionSecretsErrorCode.NotFound }

const build = async (em: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            ConnectionSecretsService,
            { provide: CONNECTION_SECRETS_OPTIONS, useValue: options },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
        ],
    }).compile()
    return moduleRef.get(ConnectionSecretsService)
}

/** A service whose joined read answers these rows. */
const readerOf = async (rows: ReadonlyArray<unknown>) => {
    const em = mockEntityManager()
    const seen = answerByTable(em, { "": rows })
    return { service: await build(em), em, seen }
}

/** The sealed text a write carried. */
const sealedOf = (values: unknown): string => {
    const found: unknown = typeof values === "object" && values !== null ? Reflect.get(values, "ciphertext") : undefined
    return typeof found === "string" ? found : ""
}

const registerSealing = () => {
    it("refuses a sealing key that is not 32 bytes", async () => {
        const failing = Test.createTestingModule({
            providers: [
                ConnectionSecretsService,
                { provide: CONNECTION_SECRETS_OPTIONS, useValue: { tokenKey: new Secret("short") } },
                { provide: PRIMARY_ENTITY_MANAGER, useValue: mockEntityManager() },
            ],
        }).compile()

        await expect(failing).rejects.toMatchObject({ code: ConnectionSecretsErrorCode.KeyInvalid })
    })

    it("seals a credential that secretOf opens again", async () => {
        const { service } = await readerOf([])
        const reading = await readerOf([readOf({ ciphertext: service.seal("hello") })])

        await expect(reading.service.secretOf("c-1", "telegram")).resolves.toMatchObject({
            kind: "ok",
            value: { credential: "hello" },
        })
    })

    it("opens a text seal sealed, and never stores it", async () => {
        const { service, em } = await readerOf([])

        expect(service.open(service.seal("bearer-1"))).toEqual({ kind: "ok", value: "bearer-1" })
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
        expect(em.findOne).not.toHaveBeenCalled()
    })

    it("refuses a text sealed with another key as unreadable", async () => {
        const { service } = await readerOf([])

        expect(service.open(sealSecret(randomBytes(32), "x"))).toMatchObject({
            kind: "refused",
            code: ConnectionSecretsErrorCode.Unreadable,
        })
    })
}

const registerKeyCheck = () => {
    it("passes when no credential is sealed yet, or when the key opens the stored one", async () => {
        const none = await build(mockEntityManager({ findOne: [ConnectionSecretEntity, null] }))
        const opens = await build(mockEntityManager({ findOne: [ConnectionSecretEntity, storedOf()] }))

        await expect(none.assertKeyOpensStored()).resolves.toBeUndefined()
        await expect(opens.assertKeyOpensStored()).resolves.toBeUndefined()
    })

    it("fails loudly with CONNECTION_SECRETS_KEY_MISMATCH when the key was overwritten under a stored credential", async () => {
        const wrong = storedOf({ ciphertext: sealSecret(randomBytes(32), "x") })
        const service = await build(mockEntityManager({ findOne: [ConnectionSecretEntity, wrong] }))

        await expect(service.assertKeyOpensStored()).rejects.toMatchObject({
            code: ConnectionSecretsErrorCode.KeyMismatch,
        })
        expect(() => service.assertOpens(sealSecret(randomBytes(32), "y"))).toThrow(
            ConnectionSecretsErrorCode.KeyMismatch,
        )
        expect(() => service.assertOpens(null)).not.toThrow()
    })
}

describe("ConnectionSecretsService", () => {
    registerSealing()
    registerKeyCheck()
})

const registerSecretOf = () => {
    it("opens the credential of a connected connection of the provider", async () => {
        const { service, seen } = await readerOf([readOf()])

        await expect(service.secretOf("c-1", "telegram")).resolves.toEqual({
            kind: "ok",
            value: { workspaceId: "ws-1", credential: "123:token", webhookSecret: "hook-secret", tokenExpiresAt: null },
        })
        expect(seen.queries[0]?.callsOf("where")).toEqual([["s.connectionId = :connectionId", { connectionId: "c-1" }]])
    })

    it("reads through the transaction manager it is given", async () => {
        const { service, em } = await readerOf([])
        const inside = mockEntityManager()
        answerByTable(inside, { "": [readOf()] })

        await expect(service.secretOf("c-1", "telegram", inside)).resolves.toMatchObject({ kind: "ok" })
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })

    it("refuses a missing connection, another provider and a disconnected one", async () => {
        const missing = await readerOf([])
        const other = await readerOf([readOf()])
        const gone = await readerOf([readOf({ status: "disconnected" })])

        await expect(missing.service.secretOf("c-1", "telegram")).resolves.toMatchObject(NOT_FOUND)
        await expect(other.service.secretOf("c-1", "zalo_oa")).resolves.toMatchObject(NOT_FOUND)
        await expect(gone.service.secretOf("c-1", "telegram")).resolves.toMatchObject(NOT_FOUND)
    })

    it("refuses a credential sealed with another key and names the failure", async () => {
        const { service } = await readerOf([readOf({ ciphertext: sealSecret(randomBytes(32), "x") })])

        await expect(service.secretOf("c-1", "telegram")).resolves.toMatchObject({
            kind: "refused",
            code: ConnectionSecretsErrorCode.Unreadable,
            params: { reason: textLike },
        })
    })
}

const registerBotToken = () => {
    it("answers the token only to the workspace that owns the connection", async () => {
        const { service } = await readerOf([readOf()])

        await expect(service.botToken("ws-1", "c-1")).resolves.toEqual({ kind: "ok", value: "123:token" })
        await expect(service.botToken("ws-2", "c-1")).resolves.toMatchObject(NOT_FOUND)
    })

    it("passes the refusal of a connection that is gone", async () => {
        const { service } = await readerOf([])

        await expect(service.botToken("ws-1", "c-1")).resolves.toMatchObject(NOT_FOUND)
    })
}

const registerLease = () => {
    const now = new Date("2026-10-12T10:00:00.000Z")
    const until = new Date("2026-10-12T10:00:30.000Z")

    it("replaces the sealed text, with the end of the access token when given", async () => {
        const em = mockEntityManager({ update: [ConnectionSecretEntity, { affected: 1 }] })
        const service = await build(em)
        const expiry = new Date("2026-10-12T11:00:00.000Z")

        await service.save("c-1", "sealed")
        await service.save("c-1", "sealed", expiry)

        expect(namedCalls(em.update.mock.calls)).toEqual([
            ["ConnectionSecretEntity", { connectionId: "c-1" }, { ciphertext: "sealed" }],
            [
                "ConnectionSecretEntity",
                { connectionId: "c-1" },
                { ciphertext: "sealed", tokenExpiresAt: expiry, refreshLockUntil: null },
            ],
        ])
    })

    it("is taken when nobody holds a live one and refused when another caller does", async () => {
        const free = await readerOf([{ connectionId: "c-1" }])
        const held = await readerOf([])

        await expect(free.service.takeLease("c-1", until, now)).resolves.toBe(true)
        await expect(held.service.takeLease("c-1", until, now)).resolves.toBe(false)
        expect(free.seen.queries[0]?.callsOf("set")).toEqual([[{ refreshLockUntil: until }]])
        expect(free.seen.queries[0]?.callsOf("where")).toEqual([
            [
                "connection_id = :connectionId AND (refresh_lock_until IS NULL OR refresh_lock_until < :now)",
                { connectionId: "c-1", now },
            ],
        ])
    })

    it("is dropped by releaseLease", async () => {
        const em = mockEntityManager({ update: [ConnectionSecretEntity, { affected: 1 }] })

        await (await build(em)).releaseLease("c-1")

        expect(namedCalls(em.update.mock.calls)).toEqual([
            ["ConnectionSecretEntity", { connectionId: "c-1" }, { refreshLockUntil: null }],
        ])
    })

    it("answers the ids of the connections whose token ends before the horizon", async () => {
        const { service, seen } = await readerOf([{ connectionId: "c-1" }, { connectionId: "c-2" }])
        const horizon = new Date("2026-10-12T17:00:00.000Z")

        await expect(service.dueZalo(horizon)).resolves.toEqual(["c-1", "c-2"])
        expect(seen.queries[0]?.callsOf("andWhere")).toEqual([
            ["s.token_expires_at IS NOT NULL AND s.token_expires_at < :horizon", { horizon }],
        ])
    })
}

describe("ConnectionSecretsService", () => {
    describe("secretOf", registerSecretOf)
    describe("botToken", registerBotToken)
    describe("lease and refresh", registerLease)
})

const registerCreate = () => {
    it("seals new credentials using the default manager", async () => {
        const em = mockEntityManager({ insert: [ConnectionSecretEntity, { raw: [] }] })
        const service = await build(em)

        await expect(service.create("c-1", "new-token", "new-hook")).resolves.toBeUndefined()

        const sealed = sealedOf(em.insert.mock.calls[0]?.[1])
        expect(openSecret(KEY, sealed)).toBe("new-token")
        expect(namedCalls(em.insert.mock.calls)).toEqual([
            ["ConnectionSecretEntity", { connectionId: "c-1", ciphertext: sealed, webhookSecret: "new-hook" }],
        ])
    })

    it("inserts credentials through the caller transaction manager", async () => {
        const em = mockEntityManager()
        const inside = mockEntityManager({ insert: [ConnectionSecretEntity, { raw: [] }] })
        const service = await build(em)

        await expect(service.create("c-2", "inside-token", "inside-hook", inside)).resolves.toBeUndefined()

        const sealed = sealedOf(inside.insert.mock.calls[0]?.[1])
        expect(openSecret(KEY, sealed)).toBe("inside-token")
        expect(namedCalls(inside.insert.mock.calls)).toEqual([
            ["ConnectionSecretEntity", { connectionId: "c-2", ciphertext: sealed, webhookSecret: "inside-hook" }],
        ])
        expect(em.insert).not.toHaveBeenCalled()
    })

    it("reads the opened credential and webhook secret, or null when absent", async () => {
        const found = mockEntityManager({ findOne: [ConnectionSecretEntity, storedOf()] })
        const missing = mockEntityManager({ findOne: [ConnectionSecretEntity, null] })

        await expect((await build(found)).read("c-1")).resolves.toEqual({
            plain: "stored-token",
            webhookSecret: "hook",
        })
        await expect((await build(missing)).read("c-9")).resolves.toBeNull()
        expect(namedCalls(found.findOne.mock.calls)).toEqual([
            [
                "ConnectionSecretEntity",
                { select: { ciphertext: true, webhookSecret: true }, where: { connectionId: "c-1" } },
            ],
        ])
        expect(namedCalls(missing.findOne.mock.calls)).toEqual([
            [
                "ConnectionSecretEntity",
                { select: { ciphertext: true, webhookSecret: true }, where: { connectionId: "c-9" } },
            ],
        ])
    })
}

const registerWrite = () => {
    it("writes a sealed credential and explicitly replaces a provided webhook secret", async () => {
        const { service, seen } = await readerOf([])

        await expect(service.write("c-1", "replacement", "hook-replacement")).resolves.toBeUndefined()

        const write = seen.queries[0]
        const sealed = sealedOf(write?.callsOf("values")[0]?.[0])
        expect(openSecret(KEY, sealed)).toBe("replacement")
        expect(write?.callsOf("values")).toEqual([
            [{ connectionId: "c-1", ciphertext: sealed, webhookSecret: "hook-replacement" }],
        ])
        expect(write?.callsOf("orUpdate")).toEqual([[["ciphertext", "webhook_secret"], ["connection_id"]]])
    })

    it("generates a webhook secret for a new row while preserving an existing one when omitted", async () => {
        const { service, seen } = await readerOf([])

        await expect(service.write("c-1", "replacement")).resolves.toBeUndefined()

        const write = seen.queries[0]
        const sealed = sealedOf(write?.callsOf("values")[0]?.[0])
        expect(openSecret(KEY, sealed)).toBe("replacement")
        expect(write?.callsOf("values")).toEqual([[{ connectionId: "c-1", ciphertext: sealed, webhookSecret: hex64 }]])
        expect(write?.callsOf("orUpdate")).toEqual([[["ciphertext"], ["connection_id"]]])
    })

    it("deletes only the credential of the requested connection", async () => {
        const em = mockEntityManager({ delete: [ConnectionSecretEntity, { affected: 1 }] })

        await expect((await build(em)).wipe("c-1")).resolves.toBeUndefined()

        expect(namedCalls(em.delete.mock.calls)).toEqual([["ConnectionSecretEntity", { connectionId: "c-1" }]])
    })
}

describe("ConnectionSecretsService", () => {
    describe("stored credentials", () => {
        registerCreate()
        registerWrite()
    })
})
