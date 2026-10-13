import { mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { ConnectionSecretsService } from "@modules/domain/connection-secrets"
import { ConnectionsErrorCode, ConnectionsService } from "@modules/domain/connections"
import { ZaloWizardDraftsService } from "@modules/domain/zalo-wizard-drafts"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ok, refused } from "@modules/platform/primitives"
import type { ZaloWizardPayload } from "@modules/queues/zalo-wizard"
import type { LoadedZalo } from "./channels.contracts"
import { ChannelsError, ChannelsErrorCode } from "./errors/channels.error"
import { ZaloCredentialsService } from "./zalo-credentials.service"
import { ZaloWizardService } from "./zalo-wizard.service"

const loaded = (oaSecret = "oa-secret"): LoadedZalo => ({
    secret: {
        appId: "app-1",
        appSecret: "app-secret",
        oaSecret,
        accessToken: "access-1",
        refreshToken: "refresh-1",
    },
    expiresAt: null,
    workspaceId: "ws-1",
})

const payload = (command: ZaloWizardPayload["command"]) => ({
    workspaceId: "ws-1",
    connectionId: "c-1",
    command,
    ticket: "ticket-1",
})

const build = async () => {
    const logger = mock<Logger>()
    const secrets = mock<ConnectionSecretsService>()
    secrets.seal.mockImplementation((plain) => `sealed:${plain}`)
    secrets.save.mockResolvedValue(undefined)
    const drafts = mock<ZaloWizardDraftsService>()
    drafts.draftOf.mockResolvedValue({
        present: true,
        appId: "app-1",
        appSecret: "app-secret",
        oaSecret: "oa-secret-2",
    })
    drafts.dropDraft.mockResolvedValue(undefined)
    const connections = mock<ConnectionsService>()
    connections.intakeOf.mockResolvedValue(ok({ id: "c-1", workspaceId: "ws-1", status: "pending" }))
    connections.settleWizard.mockResolvedValue(undefined)
    const credentials = mock<ZaloCredentialsService>()
    credentials.load.mockResolvedValue(ok(loaded()))
    credentials.beginAuthorization.mockResolvedValue({
        url: "https://oauth.test/permission",
        callbackUrl: "https://nivo.test/connections/zalo/callback",
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            ZaloWizardService,
            { provide: LOGGER, useValue: logger },
            { provide: ConnectionSecretsService, useValue: secrets },
            { provide: ZaloWizardDraftsService, useValue: drafts },
            { provide: ConnectionsService, useValue: connections },
            { provide: ZaloCredentialsService, useValue: credentials },
        ],
    }).compile()
    return { service: moduleRef.get(ZaloWizardService), logger, secrets, drafts, connections, credentials }
}

describe("ZaloWizardService", () => {
    it.each([undefined, null, [], "app", {}, { ...payload("app"), ticket: 1 }])(
        "ignores a payload that is not a wizard request: %p",
        async (input) => {
            const { service, logger, secrets, drafts, connections, credentials } = await build()

            await expect(service.run(input)).resolves.toBeUndefined()

            expect(connections.intakeOf).not.toHaveBeenCalled()
            expect(connections.settleWizard).not.toHaveBeenCalled()
            expect(drafts.draftOf).not.toHaveBeenCalled()
            expect(secrets.save).not.toHaveBeenCalled()
            expect(credentials.load).not.toHaveBeenCalled()
            expect(credentials.beginAuthorization).not.toHaveBeenCalled()
            expect(logger.error).not.toHaveBeenCalled()
        },
    )

    it("begins authorization and settles the permission URL under its ticket", async () => {
        const { service, credentials, connections, drafts, secrets } = await build()

        await service.run(payload("begin"))

        expect(credentials.beginAuthorization.mock.calls).toEqual([["ws-1", "c-1"]])
        expect(connections.settleWizard.mock.calls).toEqual([
            [
                "c-1",
                "ticket-1",
                {
                    command: "begin",
                    state: "done",
                    url: "https://oauth.test/permission",
                    code: "",
                    oaSecretSaved: false,
                },
            ],
        ])
        expect(connections.intakeOf).not.toHaveBeenCalled()
        expect(drafts.draftOf).not.toHaveBeenCalled()
        expect(secrets.save).not.toHaveBeenCalled()
    })

    it("seals only the app keys from the draft, drops it, and settles the app command", async () => {
        const { service, secrets, drafts, connections, credentials } = await build()

        await service.run({ ...payload("app"), appId: "queue-app", appSecret: "queue-secret" })

        expect(connections.intakeOf.mock.calls).toEqual([["c-1", "zalo_oa"]])
        expect(drafts.draftOf.mock.calls).toEqual([["c-1"]])
        expect(secrets.seal.mock.calls).toEqual([['{"appId":"app-1","appSecret":"app-secret","oaSecret":""}']])
        expect(secrets.save.mock.calls).toEqual([
            ["c-1", 'sealed:{"appId":"app-1","appSecret":"app-secret","oaSecret":""}'],
        ])
        expect(drafts.dropDraft.mock.calls).toEqual([["c-1"]])
        expect(connections.settleWizard.mock.calls).toEqual([
            ["c-1", "ticket-1", { command: "app", state: "done", url: "", code: "", oaSecretSaved: false }],
        ])
        expect(credentials.load).not.toHaveBeenCalled()
    })

    it.each([
        { appId: "", appSecret: "app-secret" },
        { appId: "app-1", appSecret: "" },
    ])("fails an app draft with an empty app key: %p", async (keys) => {
        const { service, secrets, drafts, connections, logger } = await build()
        drafts.draftOf.mockResolvedValue({ present: true, ...keys, oaSecret: "" })

        await service.run(payload("app"))

        expect(connections.settleWizard.mock.calls).toEqual([
            [
                "c-1",
                "ticket-1",
                { command: "app", state: "failed", url: "", code: "CHANNELS_SECRET_UNREADABLE", oaSecretSaved: false },
            ],
        ])
        expect(secrets.save).not.toHaveBeenCalled()
        expect(drafts.dropDraft).not.toHaveBeenCalled()
        expect(logger.error).not.toHaveBeenCalled()
    })

    it("seals the OA key into the existing credential and settles that it was saved", async () => {
        const { service, secrets, drafts, connections, credentials } = await build()

        await service.run({ ...payload("oa"), oaSecret: "queue-secret" })

        expect(connections.intakeOf.mock.calls).toEqual([["c-1", "zalo_oa"]])
        expect(drafts.draftOf.mock.calls).toEqual([["c-1"]])
        expect(credentials.load.mock.calls).toEqual([["c-1"]])
        expect(secrets.seal.mock.calls).toEqual([
            [
                '{"appId":"app-1","appSecret":"app-secret","oaSecret":"oa-secret-2","accessToken":"access-1","refreshToken":"refresh-1"}',
            ],
        ])
        expect(secrets.save.mock.calls).toEqual([
            [
                "c-1",
                'sealed:{"appId":"app-1","appSecret":"app-secret","oaSecret":"oa-secret-2","accessToken":"access-1","refreshToken":"refresh-1"}',
            ],
        ])
        expect(drafts.dropDraft.mock.calls).toEqual([["c-1"]])
        expect(connections.settleWizard.mock.calls).toEqual([
            ["c-1", "ticket-1", { command: "oa", state: "done", url: "", code: "", oaSecretSaved: true }],
        ])
    })

    it("fails an OA command whose existing credential is unreadable", async () => {
        const { service, credentials, connections, secrets, drafts } = await build()
        credentials.load.mockResolvedValue(refused(ChannelsErrorCode.SecretUnreadable))

        await service.run(payload("oa"))

        expect(connections.settleWizard.mock.calls).toEqual([
            [
                "c-1",
                "ticket-1",
                { command: "oa", state: "failed", url: "", code: "CHANNELS_SECRET_UNREADABLE", oaSecretSaved: false },
            ],
        ])
        expect(secrets.save).not.toHaveBeenCalled()
        expect(drafts.dropDraft).not.toHaveBeenCalled()
    })

    it("settles a redelivered app command with a readable credential when the draft is gone", async () => {
        const { service, credentials, connections, secrets, drafts } = await build()
        drafts.draftOf.mockResolvedValue({ present: false, appId: "", appSecret: "", oaSecret: "" })

        await service.run(payload("app"))

        expect(credentials.load.mock.calls).toEqual([["c-1"]])
        expect(connections.settleWizard.mock.calls).toEqual([
            ["c-1", "ticket-1", { command: "app", state: "done", url: "", code: "", oaSecretSaved: false }],
        ])
        expect(secrets.save).not.toHaveBeenCalled()
        expect(drafts.dropDraft).not.toHaveBeenCalled()
    })

    it.each<ZaloWizardPayload["command"]>(["app", "oa"])(
        "fails a redelivered %s command with no draft and an unreadable credential",
        async (command) => {
            const { service, credentials, connections, secrets, drafts } = await build()
            drafts.draftOf.mockResolvedValue({ present: false, appId: "", appSecret: "", oaSecret: "" })
            credentials.load.mockResolvedValue(refused(ChannelsErrorCode.SecretUnreadable))

            await service.run(payload(command))

            expect(credentials.load.mock.calls).toEqual([["c-1"]])
            expect(connections.settleWizard.mock.calls).toEqual([
                [
                    "c-1",
                    "ticket-1",
                    { command, state: "failed", url: "", code: "CHANNELS_SECRET_UNREADABLE", oaSecretSaved: false },
                ],
            ])
            expect(secrets.save).not.toHaveBeenCalled()
            expect(drafts.dropDraft).not.toHaveBeenCalled()
        },
    )

    it.each([
        { oaSecret: "oa-secret", oaSecretSaved: true },
        { oaSecret: "", oaSecretSaved: false },
    ])("settles a redelivered OA command from the readable credential: %p", async ({ oaSecret, oaSecretSaved }) => {
        const { service, credentials, connections, secrets, drafts } = await build()
        drafts.draftOf.mockResolvedValue({ present: false, appId: "", appSecret: "", oaSecret: "" })
        credentials.load.mockResolvedValue(ok(loaded(oaSecret)))

        await service.run(payload("oa"))

        expect(credentials.load.mock.calls).toEqual([["c-1"]])
        expect(connections.settleWizard.mock.calls).toEqual([
            ["c-1", "ticket-1", { command: "oa", state: "done", url: "", code: "", oaSecretSaved }],
        ])
        expect(secrets.save).not.toHaveBeenCalled()
        expect(drafts.dropDraft).not.toHaveBeenCalled()
    })

    it("uses the readable credential for an OA draft with an empty key", async () => {
        const { service, credentials, connections, secrets, drafts } = await build()
        drafts.draftOf.mockResolvedValue({ present: true, appId: "", appSecret: "", oaSecret: "" })

        await service.run(payload("oa"))

        expect(credentials.load.mock.calls).toEqual([["c-1"]])
        expect(connections.settleWizard.mock.calls).toEqual([
            ["c-1", "ticket-1", { command: "oa", state: "done", url: "", code: "", oaSecretSaved: true }],
        ])
        expect(secrets.save).not.toHaveBeenCalled()
        expect(drafts.dropDraft).not.toHaveBeenCalled()
    })

    it.each<ZaloWizardPayload["command"]>(["app", "oa"])(
        "logs and settles a missing connection for %s",
        async (command) => {
            const { service, connections, drafts, logger } = await build()
            connections.intakeOf.mockResolvedValue(refused(ConnectionsErrorCode.NotFound))

            await service.run(payload(command))

            expect(connections.intakeOf.mock.calls).toEqual([["c-1", "zalo_oa"]])
            expect(connections.settleWizard.mock.calls).toEqual([
                [
                    "c-1",
                    "ticket-1",
                    { command, state: "failed", url: "", code: "CHANNELS_CONNECTION_NOT_FOUND", oaSecretSaved: false },
                ],
            ])
            expect(logger.error.mock.calls).toHaveLength(1)
            expect(logger.error.mock.calls[0]?.[0]).toBe("channels.zalo.wizard-refused")
            expect(logger.error.mock.calls[0]?.[1]).toBeInstanceOf(ChannelsError)
            expect(logger.error.mock.calls[0]?.[1]).toMatchObject({ code: "CHANNELS_CONNECTION_NOT_FOUND" })
            expect(logger.error.mock.calls[0]?.[2]).toEqual({ connectionId: "c-1", command })
            expect(drafts.draftOf).not.toHaveBeenCalled()
        },
    )

    it("logs and settles a connection belonging to another workspace", async () => {
        const { service, connections, drafts, logger } = await build()
        connections.intakeOf.mockResolvedValue(ok({ id: "c-1", workspaceId: "ws-2", status: "pending" }))

        await service.run(payload("app"))

        expect(connections.settleWizard.mock.calls).toEqual([
            [
                "c-1",
                "ticket-1",
                {
                    command: "app",
                    state: "failed",
                    url: "",
                    code: "CHANNELS_CONNECTION_NOT_FOUND",
                    oaSecretSaved: false,
                },
            ],
        ])
        expect(logger.error.mock.calls).toHaveLength(1)
        expect(logger.error.mock.calls[0]?.[0]).toBe("channels.zalo.wizard-refused")
        expect(logger.error.mock.calls[0]?.[1]).toMatchObject({ code: "CHANNELS_CONNECTION_NOT_FOUND" })
        expect(logger.error.mock.calls[0]?.[2]).toEqual({ connectionId: "c-1", command: "app" })
        expect(drafts.draftOf).not.toHaveBeenCalled()
    })

    it("logs a refused authorization and settles its channels code", async () => {
        const { service, credentials, connections, logger } = await build()
        const cause = new ChannelsError({ code: ChannelsErrorCode.ZaloNotAuthorized })
        credentials.beginAuthorization.mockRejectedValue(cause)

        await service.run(payload("begin"))

        expect(logger.error.mock.calls).toEqual([
            ["channels.zalo.wizard-refused", cause, { connectionId: "c-1", command: "begin" }],
        ])
        expect(connections.settleWizard.mock.calls).toEqual([
            [
                "c-1",
                "ticket-1",
                {
                    command: "begin",
                    state: "failed",
                    url: "",
                    code: "CHANNELS_ZALO_NOT_AUTHORIZED",
                    oaSecretSaved: false,
                },
            ],
        ])
    })

    it("propagates a failure outside channels without settling or removing the draft", async () => {
        const { service, secrets, connections, drafts, logger } = await build()
        const cause = { reason: "secret storage unavailable" }
        secrets.save.mockRejectedValue(cause)

        await expect(service.run(payload("app"))).rejects.toBe(cause)

        expect(connections.settleWizard).not.toHaveBeenCalled()
        expect(drafts.dropDraft).not.toHaveBeenCalled()
        expect(logger.error).not.toHaveBeenCalled()
    })
})
