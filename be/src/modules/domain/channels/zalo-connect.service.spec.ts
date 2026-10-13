import { builder, mock } from "@starci/jest-preset"
import type { MockOf } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { ConnectionSecretsService } from "@modules/domain/connection-secrets"
import { ConnectionsErrorCode, ConnectionsService } from "@modules/domain/connections"
import type { ConnectionActor, ConnectionRecord } from "@modules/domain/connections"
import { ZaloError, ZaloErrorCode } from "@modules/integrations/zalo"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ok, refused } from "@modules/platform/primitives"
import type { ZaloAuthorization, ZaloReturn, ZaloSecret } from "./channels.contracts"
import { ChannelsLogEvent } from "./channels.log-events"
import { ChannelsError, ChannelsErrorCode } from "./errors/channels.error"
import { ZALO_AUTHORIZATION_FAILED_REASON } from "./messages/channels.messages"
import { ZaloConnectService } from "./zalo-connect.service"
import { ZaloCredentialsService } from "./zalo-credentials.service"

const actor: ConnectionActor = { principalId: "owner-1", workspaceId: "ws-1" }
const CALLBACK = "https://nivo.test/connections/zalo/callback"
const stored: ZaloSecret = {
    appId: "123456",
    appSecret: "app-secret",
    oaSecret: "",
    accessToken: "access-1",
    refreshToken: "refresh-1",
}

const connection = builder<ConnectionRecord>({
    id: "c-1",
    workspaceId: "ws-1",
    provider: "zalo_oa",
    name: "Shop OA",
    meta: { app_id: "123456" },
    status: "pending",
    lastError: null,
    environment: "live",
    isDefault: false,
    lastEventAt: null,
    createdAt: "2026-10-01T00:00:00.000Z",
    createdBy: "owner-1",
    firstEvent: null,
})

const authorization: ZaloAuthorization = {
    url: "https://oauth.test/permission",
    callbackUrl: CALLBACK,
}

const build = async () => {
    const logger = mock<Logger>()
    const connections = mock<ConnectionsService>()
    connections.authorize.mockResolvedValue({ role: "owner", displayName: "Lan" })
    connections.create.mockResolvedValue("c-1")
    connections.get.mockImplementation((workspaceId, id) => Promise.resolve(connection({ id, workspaceId })))
    connections.webhookUrl.mockImplementation((provider, id) => `https://hooks.test/${provider}/${id}`)
    connections.agentIds.mockResolvedValue(["agent-1"])
    connections.find.mockResolvedValue(null)
    connections.patch.mockResolvedValue(undefined)
    connections.markFailing.mockResolvedValue(undefined)
    const secrets = mock<ConnectionSecretsService>()
    secrets.seal.mockImplementation((plain) => `sealed:${plain}`)
    secrets.save.mockResolvedValue(undefined)
    const credentials = mock<ZaloCredentialsService>()
    credentials.callbackUrl.mockReturnValue(CALLBACK)
    credentials.load.mockResolvedValue(ok({ secret: stored, expiresAt: null, workspaceId: "ws-1" }))
    credentials.beginAuthorization.mockResolvedValue(authorization)
    credentials.completeAuthorization.mockResolvedValue("c-1")
    const moduleRef = await Test.createTestingModule({
        providers: [
            ZaloConnectService,
            { provide: LOGGER, useValue: logger },
            { provide: ConnectionsService, useValue: connections },
            { provide: ConnectionSecretsService, useValue: secrets },
            { provide: ZaloCredentialsService, useValue: credentials },
        ],
    }).compile()
    return { service: moduleRef.get(ZaloConnectService), logger, connections, secrets, credentials }
}

const createdOf = (connections: MockOf<ConnectionsService>) => connections.create.mock.calls[0]?.[0]

describe("ZaloConnectService", () => {
    describe("start", () => {
        it("seals the trimmed app keys on a pending Zalo connection and never returns them", async () => {
            const { service, connections, credentials } = await build()

            await expect(
                service.start(actor, { name: " Shop OA ", appId: " 123456 ", appSecret: " 12345678 " }),
            ).resolves.toEqual({
                id: "c-1",
                name: "Shop OA",
                status: "pending",
                webhookUrl: "https://hooks.test/zalo_oa/c-1",
                callbackUrl: CALLBACK,
                authorized: false,
                oaSecretSaved: false,
                oaId: "",
                firstEvent: null,
                agentIds: ["agent-1"],
            })

            const created = createdOf(connections)
            expect(created?.secret.webhookSecret).toMatch(/^[0-9a-f]{64}$/u)
            expect(connections.authorize.mock.calls).toEqual([[actor, ["owner"]]])
            expect(connections.create.mock.calls).toEqual([
                [
                    {
                        workspaceId: "ws-1",
                        createdBy: "owner-1",
                        provider: "zalo_oa",
                        name: " Shop OA ",
                        status: "pending",
                        environment: "live",
                        meta: { app_id: "123456" },
                        secret: {
                            plain: JSON.stringify({ appId: "123456", appSecret: "12345678", oaSecret: "" }),
                            webhookSecret: created?.secret.webhookSecret,
                        },
                    },
                ],
            ])
            expect(connections.get.mock.calls).toEqual([["ws-1", "c-1"]])
            expect(credentials.load).not.toHaveBeenCalled()
        })

        it("accepts an app id of 30 digits", async () => {
            const { service, connections } = await build()
            const appId = "1".repeat(30)

            await service.start(actor, { name: "Shop OA", appId, appSecret: "12345678" })

            expect(createdOf(connections)?.meta).toEqual({ app_id: appId })
            expect(createdOf(connections)?.secret.plain).toBe(
                JSON.stringify({ appId, appSecret: "12345678", oaSecret: "" }),
            )
        })

        it.each(["12345", "12345a", "1".repeat(31), "12 3456"])(
            "refuses an app id that is not 6 to 30 digits: %s",
            async (appId) => {
                const { service, connections } = await build()

                await expect(
                    service.start(actor, { name: "Shop OA", appId, appSecret: "12345678" }),
                ).rejects.toMatchObject({
                    code: ConnectionsErrorCode.CommandInvalid,
                    params: { field: "appId" },
                })

                expect(connections.authorize.mock.calls).toEqual([[actor, ["owner"]]])
                expect(connections.create).not.toHaveBeenCalled()
            },
        )

        it("refuses an app secret shorter than 8 characters after trimming", async () => {
            const { service, connections } = await build()

            await expect(
                service.start(actor, { name: "Shop OA", appId: "123456", appSecret: "  1234567  " }),
            ).rejects.toMatchObject({
                code: ConnectionsErrorCode.CommandInvalid,
                params: { field: "appSecret" },
            })

            expect(connections.create).not.toHaveBeenCalled()
        })
    })

    describe("saveOaSecret", () => {
        it.each([8, 200])("seals an OA secret of length %s into the stored credential", async (length) => {
            const { service, connections, secrets, credentials } = await build()
            const key = "k".repeat(length)
            connections.get
                .mockResolvedValueOnce(connection({ meta: { app_id: "123456" } }))
                .mockResolvedValueOnce(connection({ meta: { app_id: "123456", oa_secret_saved: "true" } }))

            await expect(service.saveOaSecret(actor, "c-1", `  ${key}  `)).resolves.toEqual({
                id: "c-1",
                name: "Shop OA",
                status: "pending",
                webhookUrl: "https://hooks.test/zalo_oa/c-1",
                callbackUrl: CALLBACK,
                authorized: false,
                oaSecretSaved: true,
                oaId: "",
                firstEvent: null,
                agentIds: ["agent-1"],
            })

            const plain = JSON.stringify({
                appId: "123456",
                appSecret: "app-secret",
                oaSecret: key,
                accessToken: "access-1",
                refreshToken: "refresh-1",
            })
            expect(connections.authorize.mock.calls).toEqual([[actor, ["owner"]]])
            expect(credentials.load.mock.calls).toEqual([["c-1"]])
            expect(secrets.seal.mock.calls).toEqual([[plain]])
            expect(secrets.save.mock.calls).toEqual([["c-1", `sealed:${plain}`]])
            expect(connections.patch.mock.calls).toEqual([
                ["ws-1", "c-1", { meta: { app_id: "123456", oa_secret_saved: "true" } }],
            ])
        })

        it.each([7, 201])("refuses an OA secret of length %s", async (length) => {
            const { service, connections, credentials, secrets } = await build()

            await expect(service.saveOaSecret(actor, "c-1", "k".repeat(length))).rejects.toMatchObject({
                code: ConnectionsErrorCode.CommandInvalid,
                params: { field: "oaSecret" },
            })

            expect(connections.get).not.toHaveBeenCalled()
            expect(credentials.load).not.toHaveBeenCalled()
            expect(secrets.save).not.toHaveBeenCalled()
        })

        it("refuses to save when the stored credential cannot be read", async () => {
            const { service, credentials, secrets, connections } = await build()
            credentials.load.mockResolvedValue(refused(ChannelsErrorCode.SecretUnreadable))

            await expect(service.saveOaSecret(actor, "c-1", "12345678")).rejects.toMatchObject({
                code: ConnectionsErrorCode.NotFound,
                params: { id: "c-1" },
            })

            expect(credentials.load.mock.calls).toEqual([["c-1"]])
            expect(secrets.save).not.toHaveBeenCalled()
            expect(connections.patch).not.toHaveBeenCalled()
        })
    })

    describe("view", () => {
        it("shows authorization, the OA id and the first event to an owner or a manager", async () => {
            const { service, connections } = await build()
            const firstEvent = { amount: 150000, content: "ACB", at: "2026-10-12T10:00:00.000Z" }
            connections.get.mockResolvedValue(
                connection({
                    meta: { authorized: "true", oa_secret_saved: "false", oa_id: "oa-9" },
                    status: "connected",
                    firstEvent,
                }),
            )

            await expect(service.view(actor, "c-1")).resolves.toEqual({
                id: "c-1",
                name: "Shop OA",
                status: "connected",
                webhookUrl: "https://hooks.test/zalo_oa/c-1",
                callbackUrl: CALLBACK,
                authorized: true,
                oaSecretSaved: false,
                oaId: "oa-9",
                firstEvent,
                agentIds: ["agent-1"],
            })

            expect(connections.authorize.mock.calls).toEqual([[actor, ["owner", "manager"]]])
            expect(connections.agentIds.mock.calls).toEqual([["ws-1", "c-1"]])
        })

        it("refuses a connection that is not a Zalo OA", async () => {
            const { service, connections, credentials } = await build()
            connections.get.mockResolvedValue(connection({ provider: "telegram" }))

            await expect(service.view(actor, "c-1")).rejects.toMatchObject({
                code: ConnectionsErrorCode.NotFound,
                params: { id: "c-1" },
            })

            expect(credentials.callbackUrl).not.toHaveBeenCalled()
            expect(connections.agentIds).not.toHaveBeenCalled()
        })
    })

    describe("authorize", () => {
        it("returns the permission page the credential service started", async () => {
            const { service, connections, credentials } = await build()

            await expect(service.authorize(actor, "c-1")).resolves.toBe(authorization)

            expect(connections.authorize.mock.calls).toEqual([[actor, ["owner"]]])
            expect(credentials.beginAuthorization.mock.calls).toEqual([["ws-1", "c-1"]])
        })
    })

    describe("finishAuthorization", () => {
        const returned = (state: string): ZaloReturn => ({ state, code: "code-1", oaId: "oa-9" })

        it("views the connection whose authorization completed", async () => {
            const { service, credentials, connections, logger } = await build()
            credentials.completeAuthorization.mockResolvedValue("c-done")

            await expect(service.finishAuthorization(actor, returned("c-done.nonce-1"))).resolves.toEqual({
                id: "c-done",
                name: "Shop OA",
                status: "pending",
                webhookUrl: "https://hooks.test/zalo_oa/c-done",
                callbackUrl: CALLBACK,
                authorized: false,
                oaSecretSaved: false,
                oaId: "",
                firstEvent: null,
                agentIds: ["agent-1"],
            })

            expect(connections.authorize.mock.calls).toEqual([[actor, ["owner", "manager"]]])
            expect(credentials.completeAuthorization.mock.calls).toEqual([["ws-1", returned("c-done.nonce-1")]])
            expect(connections.get.mock.calls).toEqual([["ws-1", "c-done"]])
            expect(logger.error).not.toHaveBeenCalled()
            expect(connections.markFailing).not.toHaveBeenCalled()
        })

        it("marks the owner's connection failing when Zalo or the state is refused, then rethrows", async () => {
            const { service, credentials, connections, logger } = await build()
            const cause = new ChannelsError({ code: ChannelsErrorCode.ZaloStateRejected })
            credentials.completeAuthorization.mockRejectedValue(cause)
            connections.find.mockResolvedValue(connection({ id: "c-own" }))

            await expect(service.finishAuthorization(actor, returned("c-1.nonce-1"))).rejects.toBe(cause)

            expect(logger.error.mock.calls).toEqual([
                [ChannelsLogEvent.ZaloAuthorizationRefused, cause, { connectionId: "c-1" }],
            ])
            expect(connections.find.mock.calls).toEqual([["ws-1", "c-1"]])
            expect(connections.markFailing.mock.calls).toEqual([["c-own", ZALO_AUTHORIZATION_FAILED_REASON]])
            expect(connections.get).not.toHaveBeenCalled()
        })

        it("logs a Zalo refusal and leaves the connection when it is not in this workspace", async () => {
            const { service, credentials, connections, logger } = await build()
            const cause = new ZaloError({
                code: ZaloErrorCode.Rejected,
                params: { path: "/v4/oa/access_token", reason: "refresh token is used" },
            })
            credentials.completeAuthorization.mockRejectedValue(cause)

            await expect(service.finishAuthorization(actor, { state: "", code: "code-1" })).rejects.toBe(cause)

            expect(logger.error.mock.calls).toEqual([
                [ChannelsLogEvent.ZaloAuthorizationRefused, cause, { connectionId: "" }],
            ])
            expect(connections.find.mock.calls).toEqual([["ws-1", ""]])
            expect(connections.markFailing).not.toHaveBeenCalled()
        })

        it.each([new Error("storage down"), new ZaloError({ code: ZaloErrorCode.Unavailable })])(
            "rethrows a failure that is not a refused authorization",
            async (cause) => {
                const { service, credentials, connections, logger } = await build()
                credentials.completeAuthorization.mockRejectedValue(cause)

                await expect(service.finishAuthorization(actor, returned("c-1.nonce-1"))).rejects.toBe(cause)

                expect(logger.error).not.toHaveBeenCalled()
                expect(connections.find).not.toHaveBeenCalled()
                expect(connections.markFailing).not.toHaveBeenCalled()
            },
        )
    })
})
