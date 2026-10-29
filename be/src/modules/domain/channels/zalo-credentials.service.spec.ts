import type { ZaloClient } from "@modules/integrations/zalo"
import type { Logger } from "@modules/platform/logging"
import { FakeClock, mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { ConnectionSecretsService } from "@modules/domain/connection-secrets"
import { ConnectionSecretReadsService, ConnectionsService } from "@modules/domain/connections"
import { ZALO, ZaloError, ZaloErrorCode } from "@modules/integrations/zalo"
import { CLOCK } from "@modules/platform/clock"
import { LOGGER } from "@modules/platform/logging"
import { CHANNELS_OPTIONS } from "./channels.decorators"
import { ChannelsError, ChannelsErrorCode } from "./errors/channels.error"
import { ZALO_AUTHORIZATION_FAILED_REASON } from "./messages/channels.messages"
import { ZaloCredentialsService } from "./zalo-credentials.service"
import {
    unreadableSecret,
    configureCredentialDoubles,
    NOW,
    HOUR,
    secretOf,
    stored,
    sealedJson,
    missing,
    zaloRefusal,
    tokens,
} from "@tests/fixtures/builders/zalo-credentials.builder"

const matching = (pattern: RegExp): unknown => expect.stringMatching(pattern)

const build = async (siteUrl: string = "https://nivo.test") => {
    const secrets = mock<ConnectionSecretsService>()
    const secretReads = mock<ConnectionSecretReadsService>()
    const connections = mock<ConnectionsService>()
    const zalo = mock<ZaloClient>()
    const logger = mock<Logger>()
    configureCredentialDoubles(secrets, secretReads, connections)
    const moduleRef = await Test.createTestingModule({
        providers: [
            ZaloCredentialsService,
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: CHANNELS_OPTIONS, useValue: { siteUrl } },
            { provide: ZALO, useValue: zalo },
            { provide: LOGGER, useValue: logger },
            { provide: ConnectionSecretsService, useValue: secrets },
            { provide: ConnectionSecretReadsService, useValue: secretReads },
            { provide: ConnectionsService, useValue: connections },
        ],
    }).compile()
    return { service: moduleRef.get(ZaloCredentialsService), secrets, secretReads, connections, zalo, logger }
}
describe("ZaloCredentialsService", () => {
    describe("callbackUrl", () => {
        it("uses the required configured site", async () => {
            expect((await build()).service.callbackUrl()).toBe("https://nivo.test/connections/zalo/callback")
        })
    })
})
describe("ZaloCredentialsService", () => {
    describe("load", () => {
        it("answers the parsed credential with the end of its access token", async () => {
            const { service, secretReads } = await build()
            secretReads.secretOf.mockResolvedValue(stored(secretOf()))
            await expect(service.load("c-1")).resolves.toEqual({
                kind: "ok",
                value: { secret: secretOf(), expiresAt: NOW + HOUR, workspaceId: "ws-1" },
            })
            expect(secretReads.secretOf).toHaveBeenCalledWith("c-1", "zalo_oa")
        })

        it("answers a null expiry when none is stored", async () => {
            const { service, secretReads } = await build()
            secretReads.secretOf.mockResolvedValue(stored(secretOf(), null))
            await expect(service.load("c-1")).resolves.toMatchObject({ value: { expiresAt: null } })
        })

        it.each([
            ['"refreshToken":"old"', "old"],
            ['"refreshToken":"old","renewalToken":"new"', "new"],
        ])("reads the legacy refreshToken key of a stored secret as the renewal token (%s)", async (keys, token) => {
            const { service, secretReads } = await build()
            secretReads.secretOf.mockResolvedValue(stored(`{"appId":"a","appSecret":"s","oaSecret":"o",${keys}}`))
            await expect(service.load("c-1")).resolves.toMatchObject({ value: { secret: { renewalToken: token } } })
        })

        it("refuses a missing connection and a credential that is not the Zalo document", async () => {
            const { service, secretReads } = await build()
            secretReads.secretOf.mockResolvedValueOnce(missing)
            secretReads.secretOf.mockResolvedValueOnce(stored("not json"))
            secretReads.secretOf.mockResolvedValueOnce(stored('{"appId":"a"}'))
            secretReads.secretOf.mockResolvedValueOnce(stored("null"))
            secretReads.secretOf.mockResolvedValueOnce(stored('"text"'))
            secretReads.secretOf.mockResolvedValueOnce(stored('{"appId":"a","appSecret":1,"oaSecret":"o"}'))
            secretReads.secretOf.mockResolvedValueOnce(stored('{"appId":"a","appSecret":"s","oaSecret":1}'))
            await expect(service.load("c-1")).resolves.toEqual({
                kind: "refused",
                code: "CHANNELS_CONNECTION_NOT_FOUND",
                params: undefined,
            })
            await expect(service.load("c-1")).resolves.toMatchObject({
                kind: "refused",
                code: ChannelsErrorCode.SecretUnreadable,
            })
            await expect(service.load("c-1")).resolves.toEqual(unreadableSecret)
            await expect(service.load("c-1")).resolves.toEqual(unreadableSecret)
            await expect(service.load("c-1")).resolves.toEqual(unreadableSecret)
            await expect(service.load("c-1")).resolves.toEqual(unreadableSecret)
            await expect(service.load("c-1")).resolves.toEqual(unreadableSecret)
        })
    })
})
describe("ZaloCredentialsService", () => {
    describe("beginAuthorization", () => {
        it("stores a verifier with a one-time nonce and answers the permission page", async () => {
            const { service, zalo, secrets, secretReads } = await build()
            secretReads.secretOf.mockResolvedValue(stored(secretOf()))
            zalo.authorizeUrl.mockReturnValue("https://oauth.test/permission")
            const result = await service.beginAuthorization("ws-1", "c-1")
            expect(result).toEqual({
                url: "https://oauth.test/permission",
                callbackUrl: "https://nivo.test/connections/zalo/callback",
            })
            const sealed = String(secrets.save.mock.calls[0]?.[1])
            const pkce: unknown = Reflect.get(sealedJson(sealed), "pkce")
            expect(pkce).toEqual({
                verifier: matching(/^[\w-]{64}$/u),
                nonce: matching(/^[0-9a-f]{64}$/u),
                exp: NOW + 900_000,
            })
            expect(zalo.authorizeUrl).toHaveBeenCalledWith(
                "app-1",
                "https://nivo.test/connections/zalo/callback",
                Reflect.get(Object(pkce), "verifier"),
                `c-1.${Reflect.get(Object(pkce), "nonce")}`,
            )
            expect(secrets.save).toHaveBeenCalledWith("c-1", sealed, undefined)
        })

        it("refuses a connection of another workspace and a missing one", async () => {
            const { service, secretReads } = await build()
            secretReads.secretOf.mockResolvedValueOnce({
                ...stored(secretOf()),
                value: { ...stored(secretOf()).value, workspaceId: "ws-2" },
            })
            secretReads.secretOf.mockResolvedValueOnce(missing)
            await expect(service.beginAuthorization("ws-1", "c-1")).rejects.toMatchObject({
                code: ChannelsErrorCode.ConnectionNotFound,
            })
            await expect(service.beginAuthorization("ws-1", "c-1")).rejects.toMatchObject({
                code: ChannelsErrorCode.ConnectionNotFound,
            })
        })
    })
})
describe("ZaloCredentialsService", () => {
    describe("completeAuthorization", () => {
        const started = secretOf({ pkce: { verifier: "verifier-1", nonce: "nonce-1", exp: NOW + 60_000 } })

        it("exchanges the code, stores the tokens without the verifier and records the OA", async () => {
            const { service, zalo, connections, secrets, secretReads } = await build()
            secretReads.secretOf.mockResolvedValue(stored(started))
            zalo.exchangeCode.mockResolvedValue(tokens)
            await expect(
                service.completeAuthorization("ws-1", { state: "c-1.nonce-1", code: "code-1", oaId: "oa-9" }),
            ).resolves.toBe("c-1")
            expect(zalo.exchangeCode).toHaveBeenCalledWith("app-1", "app-secret", "code-1", "verifier-1")
            const sealed = String(secrets.save.mock.calls[0]?.[1])
            const saved = sealedJson(sealed)
            expect(saved).toMatchObject({
                accessToken: "access-2",
                renewalToken: "refresh-2",
                refreshExpiresAt: new Date(NOW + 90 * 86_400_000).toISOString(),
            })
            expect(Reflect.has(saved, "pkce")).toBe(false)
            expect(secrets.save).toHaveBeenCalledWith("c-1", sealed, new Date(NOW + HOUR))
            expect(connections.applyZaloAuthorization).toHaveBeenCalledWith("c-1", "oa-9")
        })

        it("refuses a return that does not match a started authorization", async () => {
            const { service, zalo, secretReads } = await build()
            secretReads.secretOf.mockResolvedValueOnce(stored(secretOf()))
            secretReads.secretOf.mockResolvedValueOnce(stored(started))
            await expect(
                service.completeAuthorization("ws-1", { state: "c-1.nonce-1", code: "x" }),
            ).rejects.toMatchObject({ code: ChannelsErrorCode.ZaloStateRejected })
            await expect(
                service.completeAuthorization("ws-1", { state: "c-1.other", code: "x" }),
            ).rejects.toMatchObject({ code: ChannelsErrorCode.ZaloStateRejected })
            expect(zalo.exchangeCode).not.toHaveBeenCalled()
        })

        it("refuses an authorization older than its time, and a state without a connection", async () => {
            const { service, secretReads } = await build()
            secretReads.secretOf.mockResolvedValueOnce(
                stored(secretOf({ pkce: { verifier: "v", nonce: "nonce-1", exp: NOW - 1 } })),
            )
            secretReads.secretOf.mockResolvedValueOnce(missing)
            await expect(
                service.completeAuthorization("ws-1", { state: "c-1.nonce-1", code: "x" }),
            ).rejects.toMatchObject({ code: ChannelsErrorCode.ZaloStateExpired })
            await expect(service.completeAuthorization("ws-1", { state: "", code: "x" })).rejects.toMatchObject({
                code: ChannelsErrorCode.ConnectionNotFound,
            })
        })
    })
})
describe("ZaloCredentialsService", () => {
    describe("completeFromJob", () => {
        const payload = { workspaceId: "ws-1", state: "c-1.nonce-1", code: "code-1", oaId: "oa-9" }

        it.each([undefined, null, "tick", [], {}, { ...payload, code: 1 }])(
            "ignores a payload that is not an authorization return: %p",
            async (input) => {
                const { service, zalo, connections, logger, secretReads } = await build()

                await expect(service.completeFromJob(input)).resolves.toBeUndefined()
                expect(secretReads.secretOf).not.toHaveBeenCalled()
                expect(zalo.exchangeCode).not.toHaveBeenCalled()
                expect(connections.applyZaloAuthorization).not.toHaveBeenCalled()
                expect(connections.markFailing).not.toHaveBeenCalled()
                expect(logger.error).not.toHaveBeenCalled()
            },
        )

        it.each(["oa-9", null])("completes the queued authorization with OA %p", async (oaId) => {
            const { service, zalo, connections, logger, secretReads } = await build()
            secretReads.secretOf.mockResolvedValue(
                stored(secretOf({ pkce: { verifier: "verifier-1", nonce: "nonce-1", exp: NOW + 60_000 } })),
            )
            zalo.exchangeCode.mockResolvedValue(tokens)
            await expect(service.completeFromJob({ ...payload, oaId })).resolves.toBeUndefined()
            expect(zalo.exchangeCode.mock.calls).toEqual([["app-1", "app-secret", "code-1", "verifier-1"]])
            expect(connections.applyZaloAuthorization.mock.calls).toEqual([["c-1", oaId === null ? undefined : "oa-9"]])
            expect(connections.markFailing).not.toHaveBeenCalled()
            expect(logger.error).not.toHaveBeenCalled()
        })

        it("logs a channels refusal and marks the connection before the first dot failing", async () => {
            const { service, connections, logger, secretReads } = await build()
            const failure = new ChannelsError({ code: ChannelsErrorCode.SecretUnreadable })
            secretReads.secretOf.mockRejectedValue(failure)
            await expect(service.completeFromJob({ ...payload, state: "c-1.nonce-1.extra" })).resolves.toBeUndefined()
            expect(logger.error.mock.calls).toEqual([
                ["channels.zalo.authorization-refused", failure, { connectionId: "c-1" }],
            ])
            expect(connections.markFailing.mock.calls).toEqual([["c-1", ZALO_AUTHORIZATION_FAILED_REASON]])
        })

        it("logs a Zalo refusal and marks its connection failing", async () => {
            const { service, zalo, connections, logger, secrets, secretReads } = await build()
            secretReads.secretOf.mockResolvedValue(
                stored(secretOf({ pkce: { verifier: "verifier-1", nonce: "nonce-1", exp: NOW + 60_000 } })),
            )
            const failure = zaloRefusal(-118)
            zalo.exchangeCode.mockRejectedValue(failure)
            await expect(service.completeFromJob(payload)).resolves.toBeUndefined()
            expect(logger.error.mock.calls).toEqual([
                ["channels.zalo.authorization-refused", failure, { connectionId: "c-1" }],
            ])
            expect(connections.markFailing.mock.calls).toEqual([["c-1", ZALO_AUTHORIZATION_FAILED_REASON]])
            expect(secrets.save).not.toHaveBeenCalled()
        })
    })
})
describe("ZaloCredentialsService", () => {
    describe("completeFromJob", () => {
        const payload = { workspaceId: "ws-1", state: "c-1.nonce-1", code: "code-1", oaId: "oa-9" }

        it("rethrows other failures for retry without logging or marking the connection", async () => {
            const { service, zalo, connections, logger, secretReads } = await build()
            secretReads.secretOf.mockResolvedValue(
                stored(secretOf({ pkce: { verifier: "verifier-1", nonce: "nonce-1", exp: NOW + 60_000 } })),
            )
            const failure = new ZaloError({ code: ZaloErrorCode.Unavailable })
            zalo.exchangeCode.mockRejectedValue(failure)
            await expect(service.completeFromJob(payload)).rejects.toBe(failure)
            expect(connections.markFailing).not.toHaveBeenCalled()
            expect(logger.error).not.toHaveBeenCalled()
        })

        it("records an empty connection id for an empty state", async () => {
            const { service, connections, logger, secretReads } = await build()
            const failure = new ChannelsError({ code: ChannelsErrorCode.ConnectionNotFound })
            secretReads.secretOf.mockRejectedValue(failure)
            await expect(service.completeFromJob({ ...payload, state: "" })).resolves.toBeUndefined()
            expect(secretReads.secretOf.mock.calls).toEqual([["", "zalo_oa"]])
            expect(logger.error.mock.calls).toEqual([
                ["channels.zalo.authorization-refused", failure, { connectionId: "" }],
            ])
            expect(connections.markFailing.mock.calls).toEqual([["", ZALO_AUTHORIZATION_FAILED_REASON]])
        })

        it("defaults to an empty connection id when the state split has no fields", async () => {
            const { service, connections, logger, secretReads } = await build()
            const failure = new ChannelsError({ code: ChannelsErrorCode.ConnectionNotFound })
            secretReads.secretOf.mockRejectedValue(failure)
            const split = jest
                .spyOn(String.prototype, "split")
                .mockReturnValueOnce([])
                .mockReturnValueOnce([])
                .mockReturnValueOnce([])
            try {
                await expect(service.completeFromJob(payload)).resolves.toBeUndefined()
                expect(secretReads.secretOf.mock.calls).toEqual([["", "zalo_oa"]])
                expect(logger.error.mock.calls).toEqual([
                    ["channels.zalo.authorization-refused", failure, { connectionId: "" }],
                ])
                expect(connections.markFailing.mock.calls).toEqual([["", ZALO_AUTHORIZATION_FAILED_REASON]])
            } finally {
                split.mockRestore()
            }
        })
    })
})
describe("ZaloCredentialsService", () => {
    describe("refreshFromJob", () => {
        it("uses the payload horizon to select due credentials", async () => {
            const { service, secretReads } = await build()
            await expect(service.refreshFromJob({ withinMs: 2 * HOUR })).resolves.toEqual({ refreshed: 0, failed: 0 })
            expect(secretReads.dueZalo.mock.calls).toEqual([[new Date("2026-10-12T12:00:00.000Z")]])
        })

        it.each([undefined, null, "tick", [], {}, { withinMs: "2" }])(
            "defaults to seven hours for a non-refresh payload: %p",
            async (payload) => {
                const { service, secretReads } = await build()

                await expect(service.refreshFromJob(payload)).resolves.toEqual({ refreshed: 0, failed: 0 })
                expect(secretReads.dueZalo.mock.calls).toEqual([[new Date("2026-10-12T17:00:00.000Z")]])
            },
        )
    })
})
describe("ZaloCredentialsService", () => {
    describe("accessToken", () => {
        it("answers the stored token while it has more than five minutes left", async () => {
            const { service, secrets, secretReads } = await build()
            secretReads.secretOf.mockResolvedValue(stored(secretOf()))
            await expect(service.accessToken("c-1")).resolves.toBe("access-1")
            expect(secrets.takeLease).not.toHaveBeenCalled()
        })

        it("refuses a connection that does not exist", async () => {
            const { service, secretReads } = await build()
            secretReads.secretOf.mockResolvedValue(missing)
            await expect(service.accessToken("c-1")).rejects.toMatchObject({
                code: ChannelsErrorCode.ConnectionNotFound,
            })
        })

        it("renews a token that is about to end, saves the new pair with its expiry and takes the lease for 30 seconds", async () => {
            const { service, zalo, secrets, secretReads } = await build()
            secretReads.secretOf.mockResolvedValue(stored(secretOf(), NOW + 60_000))
            zalo.refreshTokens.mockResolvedValue({ ...tokens, expiresInSeconds: 7200 })
            await expect(service.accessToken("c-1")).resolves.toBe("access-2")
            expect(zalo.refreshTokens).toHaveBeenCalledWith("app-1", "app-secret", "refresh-1")
            expect(secrets.takeLease).toHaveBeenCalledWith("c-1", new Date(NOW + 30_000), new Date(NOW))
            expect(secrets.save).toHaveBeenCalledWith(
                "c-1",
                expect.stringMatching(/^sealed:/u),
                new Date(NOW + 7_200_000),
            )
        })

        it("renews a token Zalo just rejected, or on demand, though its clock says it is fine", async () => {
            const { service, zalo, secretReads } = await build()
            secretReads.secretOf.mockResolvedValue(stored(secretOf()))
            zalo.refreshTokens.mockResolvedValue(tokens)
            await expect(service.accessToken("c-1", { stale: "access-1" })).resolves.toBe("access-2")
            await expect(service.accessToken("c-1", { force: true })).resolves.toBe("access-2")
            await expect(service.accessToken("c-1", { stale: "another" })).resolves.toBe("access-1")
        })

        it("renews a connection that has a refresh token but no access token yet", async () => {
            const { service, zalo, secretReads } = await build()
            secretReads.secretOf.mockResolvedValue(stored(secretOf({ accessToken: undefined }), null))
            zalo.refreshTokens.mockResolvedValue(tokens)
            await expect(service.accessToken("c-1")).resolves.toBe("access-2")
        })

        it("says to authorize first when the connection holds no refresh token", async () => {
            const { service, secretReads } = await build()
            secretReads.secretOf.mockResolvedValue(
                stored(secretOf({ accessToken: undefined, renewalToken: undefined }), null),
            )
            await expect(service.accessToken("c-1")).rejects.toMatchObject({
                code: ChannelsErrorCode.ZaloNotAuthorized,
            })
        })
    })
})
describe("ZaloCredentialsService", () => {
    describe("accessToken", () => {
        it("uses the token another caller renewed while this one waited for the lease", async () => {
            const { service, zalo, secrets, secretReads } = await build()
            secrets.takeLease.mockResolvedValue(false)
            secretReads.secretOf.mockResolvedValueOnce(stored(secretOf(), NOW + 60_000))
            secretReads.secretOf.mockResolvedValueOnce(stored(secretOf({ accessToken: "access-9" })))
            await expect(service.accessToken("c-1")).resolves.toBe("access-9")
            expect(zalo.refreshTokens).not.toHaveBeenCalled()
        })

        it("asks to try again when the lease is taken and no fresh token is there, even on a forced renewal", async () => {
            const { service, secrets, secretReads } = await build()
            secrets.takeLease.mockResolvedValue(false)
            secretReads.secretOf.mockResolvedValue(stored(secretOf(), NOW + 60_000))
            await expect(service.accessToken("c-1")).rejects.toMatchObject({ code: ChannelsErrorCode.ZaloRefreshBusy })
            secretReads.secretOf.mockResolvedValue(stored(secretOf()))
            await expect(service.accessToken("c-1", { force: true })).rejects.toMatchObject({
                code: ChannelsErrorCode.ZaloRefreshBusy,
            })
        })

        it("reads again under the lease and spares the refresh token when someone renewed in between", async () => {
            const { service, zalo, secrets, secretReads } = await build()
            secretReads.secretOf.mockResolvedValueOnce(stored(secretOf(), NOW + 60_000))
            secretReads.secretOf.mockResolvedValueOnce(stored(secretOf({ accessToken: "access-9" })))
            await expect(service.accessToken("c-1")).resolves.toBe("access-9")
            expect(zalo.refreshTokens).not.toHaveBeenCalled()
            expect(secrets.releaseLease).toHaveBeenCalledWith("c-1")
        })

        it("stops when the refresh token vanished under the lease, and frees the lease", async () => {
            const { service, secrets, secretReads } = await build()
            secretReads.secretOf.mockResolvedValueOnce(stored(secretOf(), NOW + 60_000))
            secretReads.secretOf.mockResolvedValueOnce(stored(secretOf({ renewalToken: undefined }), NOW + 60_000))
            await expect(service.accessToken("c-1")).rejects.toMatchObject({
                code: ChannelsErrorCode.ZaloNotAuthorized,
            })
            expect(secrets.releaseLease).toHaveBeenCalledWith("c-1")
        })

        it("marks the connection for reconnection when Zalo refuses the refresh token, and frees the lease", async () => {
            const { service, zalo, connections, secrets, secretReads } = await build()
            secretReads.secretOf.mockResolvedValue(stored(secretOf(), NOW + 60_000))
            const refusal = zaloRefusal(-118)
            zalo.refreshTokens.mockRejectedValue(refusal)
            await expect(service.accessToken("c-1")).rejects.toBe(refusal)
            expect(connections.markFailing).toHaveBeenCalledWith("c-1", expect.stringContaining("Zalo OA"))
            expect(secrets.releaseLease).toHaveBeenCalledWith("c-1")
        })

        it("leaves the connection alone when Zalo simply did not answer", async () => {
            const { service, zalo, connections, secretReads } = await build()
            secretReads.secretOf.mockResolvedValue(stored(secretOf(), NOW + 60_000))
            zalo.refreshTokens.mockRejectedValue(new ZaloError({ code: ZaloErrorCode.Unavailable }))
            await expect(service.accessToken("c-1")).rejects.toMatchObject({ code: ZaloErrorCode.Unavailable })
            expect(connections.markFailing).not.toHaveBeenCalled()
        })
    })
})
const SEALED = 'sealed:{"appId":"app-1","appSecret":"app-secret","oaSecret":"oa-secret","accessToken":"access-2","renewalToken":"refresh-2","refreshExpiresAt":"2027-01-10T10:00:00.000Z"}'
describe("ZaloCredentialsService", () => {
    describe("accessToken", () => {
        it("saves a second time when the first save fails, because the old refresh token is already spent", async () => {
            const { service, zalo, logger, secrets, secretReads } = await build()
            secretReads.secretOf.mockResolvedValue(stored(secretOf(), NOW + 60_000))
            zalo.refreshTokens.mockResolvedValue(tokens)
            const failure = new Error("connection reset")
            secrets.save.mockRejectedValueOnce(failure)
            await expect(service.accessToken("c-1")).resolves.toBe("access-2")
            expect(secrets.save).toHaveBeenCalledTimes(2)
            expect(logger.error.mock.calls).toEqual([["channels.zalo.save-retried", failure, { connectionId: "c-1" }]])
            const saved = ["c-1", SEALED, new Date("2026-10-12T11:00:00.000Z")]
            expect(secrets.save.mock.calls).toEqual([saved, saved])
        })

        it("frees the lease and reports the failure when both saves fail, logging a lease that cannot be freed", async () => {
            const { service, zalo, logger, secrets, secretReads } = await build()
            secretReads.secretOf.mockResolvedValue(stored(secretOf(), NOW + 60_000))
            zalo.refreshTokens.mockResolvedValue(tokens)
            const failure = new Error("database down")
            secrets.save.mockRejectedValue(failure)
            secrets.releaseLease.mockRejectedValue(failure)
            await expect(service.accessToken("c-1")).rejects.toBe(failure)
            expect(logger.error).toHaveBeenCalledWith("channels.zalo.lease-not-released", failure, { connectionId: "c-1" })
        })
    })
})
describe("ZaloCredentialsService", () => {
    describe("refreshDue", () => {
        it("renews every due connection and counts the ones that failed", async () => {
            const { service, zalo, logger, secretReads } = await build()
            secretReads.dueZalo.mockResolvedValue(["c-1", "c-2"])
            secretReads.secretOf.mockResolvedValueOnce(stored(secretOf()))
            secretReads.secretOf.mockResolvedValueOnce(stored(secretOf()))
            secretReads.secretOf.mockResolvedValueOnce(missing)
            zalo.refreshTokens.mockResolvedValue(tokens)
            await expect(service.refreshDue(7 * HOUR)).resolves.toEqual({ refreshed: 1, failed: 1 })
            expect(secretReads.dueZalo).toHaveBeenCalledWith(new Date(NOW + 7 * HOUR))
            expect(logger.error).toHaveBeenCalledWith("channels.zalo.refresh-failed", expect.anything(), {
                connectionId: "c-2",
            })
        })

        it("does nothing when no connection is due", async () => {
            const { service } = await build()
            await expect(service.refreshDue(HOUR)).resolves.toEqual({ refreshed: 0, failed: 0 })
        })
    })
})
