import { randomBytes } from "node:crypto"
import { mockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { Secret } from "@modules/platform/config"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { CONNECTION_SECRETS_OPTIONS } from "./connection-secrets.decorators"
import { ConnectionSecretsService } from "./connection-secrets.service"
import { ConnectionSecretsErrorCode } from "./errors/connection-secrets.error"
import {
    FIND_CONNECTION_SECRET,
    LIST_ZALO_CONNECTIONS_DUE,
    RELEASE_REFRESH_LEASE,
    SAVE_SECRET,
    SAVE_SECRET_WITH_EXPIRY,
    TRY_REFRESH_LEASE,
} from "./persistence/connection-secrets.sql"
import { sealSecret } from "./secret-cipher.policy"

const KEY = randomBytes(32)
const options = { tokenKey: new Secret(KEY.toString("base64")) }

const row = (patch: Record<string, unknown> = {}) => ({
    workspace_id: "ws-1",
    provider: "telegram",
    status: "connected",
    ciphertext: sealSecret(KEY, "123:token"),
    webhook_secret: "hook-secret",
    token_expires_at: null,
    ...patch,
})

const build = async (answers: Record<string, unknown> = {}) => {
    const em = mockEntityManager({
        query: Object.entries({
            [FIND_CONNECTION_SECRET]: [],
            [SAVE_SECRET]: [],
            [SAVE_SECRET_WITH_EXPIRY]: [],
            [TRY_REFRESH_LEASE]: [{ connection_id: "c-1" }],
            [RELEASE_REFRESH_LEASE]: [],
            [LIST_ZALO_CONNECTIONS_DUE]: [],
            ...answers,
        }).map(([text, rows]): [string, unknown] => [text, rows]),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            ConnectionSecretsService,
            { provide: CONNECTION_SECRETS_OPTIONS, useValue: options },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
        ],
    }).compile()
    return { service: moduleRef.get(ConnectionSecretsService), em }
}

describe("ConnectionSecretsService", () => {
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

    describe("seal", () => {
        it("seals a credential that secretOf opens again", async () => {
            const { service } = await build({ [FIND_CONNECTION_SECRET]: [] })
            const sealed = service.seal("hello")
            const opened = await (
                await build({ [FIND_CONNECTION_SECRET]: [row({ ciphertext: sealed })] })
            ).service.secretOf("c-1", "telegram")

            expect(opened).toMatchObject({ kind: "ok", value: { credential: "hello" } })
        })
    })

    describe("secretOf", () => {
        it("opens the credential of a connected connection of the provider", async () => {
            const { service, em } = await build({ [FIND_CONNECTION_SECRET]: [row()] })

            await expect(service.secretOf("c-1", "telegram")).resolves.toEqual({
                kind: "ok",
                value: {
                    workspaceId: "ws-1",
                    credential: "123:token",
                    webhookSecret: "hook-secret",
                    tokenExpiresAt: null,
                },
            })
            expect(em.query).toHaveBeenCalledWith(FIND_CONNECTION_SECRET, ["c-1"])
        })

        it("reads through the transaction manager it is given", async () => {
            const { service, em } = await build()
            const inside = mockEntityManager({ query: [FIND_CONNECTION_SECRET, [row()]] })

            await expect(service.secretOf("c-1", "telegram", inside)).resolves.toMatchObject({ kind: "ok" })
            expect(em.query).not.toHaveBeenCalled()
        })

        it("refuses a missing connection, another provider and a disconnected one", async () => {
            const missing = await build()
            const other = await build({ [FIND_CONNECTION_SECRET]: [row()] })
            const gone = await build({ [FIND_CONNECTION_SECRET]: [row({ status: "disconnected" })] })

            await expect(missing.service.secretOf("c-1", "telegram")).resolves.toMatchObject({
                kind: "refused",
                code: ConnectionSecretsErrorCode.NotFound,
            })
            await expect(other.service.secretOf("c-1", "zalo_oa")).resolves.toMatchObject({
                kind: "refused",
                code: ConnectionSecretsErrorCode.NotFound,
            })
            await expect(gone.service.secretOf("c-1", "telegram")).resolves.toMatchObject({
                kind: "refused",
                code: ConnectionSecretsErrorCode.NotFound,
            })
        })

        it("refuses a credential sealed with another key and names the failure", async () => {
            const { service } = await build({
                [FIND_CONNECTION_SECRET]: [row({ ciphertext: sealSecret(randomBytes(32), "x") })],
            })

            await expect(service.secretOf("c-1", "telegram")).resolves.toMatchObject({
                kind: "refused",
                code: ConnectionSecretsErrorCode.Unreadable,
                params: { reason: expect.stringContaining("Error") },
            })
        })
    })

    describe("botToken", () => {
        it("answers the token only to the workspace that owns the connection", async () => {
            const { service } = await build({ [FIND_CONNECTION_SECRET]: [row()] })

            await expect(service.botToken("ws-1", "c-1")).resolves.toEqual({ kind: "ok", value: "123:token" })
            await expect(service.botToken("ws-2", "c-1")).resolves.toMatchObject({
                kind: "refused",
                code: ConnectionSecretsErrorCode.NotFound,
            })
        })

        it("passes the refusal of a connection that is gone", async () => {
            const { service } = await build()

            await expect(service.botToken("ws-1", "c-1")).resolves.toMatchObject({
                kind: "refused",
                code: ConnectionSecretsErrorCode.NotFound,
            })
        })
    })

    describe("save", () => {
        it("replaces the sealed text, with the end of the access token when given", async () => {
            const { service, em } = await build()
            const expiry = new Date("2026-10-12T11:00:00.000Z")

            await service.save("c-1", "sealed")
            await service.save("c-1", "sealed", expiry)

            expect(em.query).toHaveBeenNthCalledWith(1, SAVE_SECRET, ["c-1", "sealed"])
            expect(em.query).toHaveBeenNthCalledWith(2, SAVE_SECRET_WITH_EXPIRY, ["c-1", "sealed", expiry])
        })
    })

    describe("lease", () => {
        const now = new Date("2026-10-12T10:00:00.000Z")
        const until = new Date("2026-10-12T10:00:30.000Z")

        it("is taken when nobody holds a live one and refused when another caller does", async () => {
            const free = await build()
            const held = await build({ [TRY_REFRESH_LEASE]: [] })

            await expect(free.service.takeLease("c-1", until, now)).resolves.toBe(true)
            await expect(held.service.takeLease("c-1", until, now)).resolves.toBe(false)
            expect(free.em.query).toHaveBeenCalledWith(TRY_REFRESH_LEASE, ["c-1", until, now])
        })

        it("is dropped by releaseLease", async () => {
            const { service, em } = await build()

            await service.releaseLease("c-1")

            expect(em.query).toHaveBeenCalledWith(RELEASE_REFRESH_LEASE, ["c-1"])
        })
    })

    describe("dueZalo", () => {
        it("answers the ids of the connections whose token ends before the horizon", async () => {
            const { service, em } = await build({
                [LIST_ZALO_CONNECTIONS_DUE]: [{ connection_id: "c-1" }, { connection_id: "c-2" }],
            })
            const horizon = new Date("2026-10-12T17:00:00.000Z")

            await expect(service.dueZalo(horizon)).resolves.toEqual(["c-1", "c-2"])
            expect(em.query).toHaveBeenCalledWith(LIST_ZALO_CONNECTIONS_DUE, [horizon])
        })
    })
})
