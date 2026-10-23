import { FakeClock, mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { ConnectionsService } from "@modules/domain/connections"
import type { ConnectionRecord } from "@modules/domain/connections"
import { DRIVE_PURPOSE, GOOGLE_CLIENT, GOOGLE_SCOPE, GoogleError, GoogleErrorCode } from "@modules/integrations/google"
import type { GoogleClient, SheetConfig } from "@modules/integrations/google"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { DriveGrantService } from "./drive-grant.service"
import { GoogleConnectionsService } from "./google-connections.service"
import { GoogleTokensService } from "./google-tokens.service"
import { runRealGoogleTokens } from "@tests/fixtures/builders/google-tokens.builder"
import { GoogleConnectionsError, GoogleConnectionsErrorCode } from "./errors/google-connections.error"

import {
    actor,
    NOW,
    EXPIRES,
    state,
    tokens,
    stored,
    issued,
    event,
    sheet,
    record,
    googleRefusal,
    callback,
    location,
} from "@tests/fixtures/builders/google-connections.builder"

const matching = (pattern: RegExp): unknown => expect.stringMatching(pattern)

const build = async () => {
    const connections = mock<ConnectionsService>()
    connections.authorize.mockResolvedValue({ role: "owner", displayName: "Lan" })
    connections.siteBase.mockReturnValue("https://nivo.vn")
    connections.listByProvider.mockResolvedValue([record()])
    connections.readSecret.mockResolvedValue({ plain: JSON.stringify(stored), webhookSecret: "hook-1" })
    connections.create.mockResolvedValue("c1")
    const google = mock<GoogleClient>()
    google.isConfigured.mockReturnValue(true)
    google.sign.mockReturnValue("signed-state")
    google.authUrl.mockReturnValue("https://google.test/auth?state=signed-state")
    google.verify.mockReturnValue(state)
    google.exchangeCode.mockResolvedValue(tokens)
    google.accountEmail.mockResolvedValue("shop@example.test")
    google.refreshAccessToken.mockResolvedValue(tokens)
    google.createOrdersSpreadsheet.mockResolvedValue(sheet)
    google.applyEvent.mockResolvedValue({ evidence: "Recorded O-1" })
    const drive = mock<DriveGrantService>()
    drive.complete.mockResolvedValue(undefined)
    const tokenStore = mock<GoogleTokensService>()
    runRealGoogleTokens(tokenStore, connections, google, new FakeClock(NOW))
    const moduleRef = await Test.createTestingModule({
        providers: [
            GoogleConnectionsService,
            { provide: ConnectionsService, useValue: connections },
            { provide: GOOGLE_CLIENT, useValue: google },
            { provide: LOGGER, useValue: mock<Logger>() },
            { provide: GoogleTokensService, useValue: tokenStore },
            { provide: DriveGrantService, useValue: drive },
        ],
    }).compile()
    return { service: moduleRef.get(GoogleConnectionsService), connections, google, drive }
}

describe("GoogleConnectionsService / authorize, state and accounts", () => {
    it("signs the owner's same-site return path and answers the consent URL", async () => {
        const { service, connections, google } = await build()

        expect(service.isConfigured()).toBe(true)
        await expect(service.authorize(actor, "/automations?tab=google")).resolves.toEqual({
            url: "https://google.test/auth?state=signed-state",
        })
        expect(connections.authorize).toHaveBeenCalledWith(actor, ["owner"])
        expect(google.sign).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            userId: "owner-1",
            returnTo: "/automations?tab=google",
        })
        expect(google.authUrl).toHaveBeenCalledWith("signed-state", GOOGLE_SCOPE)

        await service.authorize(actor, "https://other.test")
        expect(google.sign).toHaveBeenLastCalledWith({
            workspaceId: "ws-1",
            userId: "owner-1",
            returnTo: "/connections",
        })
    })

    it("refuses an unavailable client and a missing authorization URL", async () => {
        const { service, google } = await build()
        google.isConfigured.mockReturnValueOnce(false)
        await expect(service.authorize(actor, "/connections")).rejects.toEqual(
            new GoogleConnectionsError({ code: GoogleConnectionsErrorCode.NotConfigured }),
        )
        google.authUrl.mockReturnValue(null)
        await expect(service.authorize(actor, "/connections")).rejects.toEqual(
            new GoogleConnectionsError({ code: GoogleConnectionsErrorCode.StartFailed }),
        )
    })

    it("reports configuration and lists account identities for owners and managers", async () => {
        const { service, connections, google } = await build()
        google.isConfigured.mockReturnValue(false)
        connections.listByProvider.mockResolvedValue([record(), record({ id: "c2", meta: {}, status: "error" })])

        expect(service.isConfigured()).toBe(false)
        await expect(service.state(actor)).resolves.toEqual({ configured: false })
        await expect(service.accounts(actor)).resolves.toEqual([
            { id: "c1", email: "shop@example.test", status: "connected" },
            { id: "c2", email: "", status: "error" },
        ])
        expect(connections.authorize.mock.calls).toEqual([
            [actor, ["owner", "manager"]],
            [actor, ["owner", "manager"]],
        ])
        expect(connections.listByProvider).toHaveBeenCalledWith("ws-1", "google", {
            includeDisconnected: false,
        })
    })
})

describe("GoogleConnectionsService / complete", () => {
    it("returns a state failure when verification returns null or throws", async () => {
        const { service, connections, google } = await build()
        google.verify.mockReturnValueOnce(null).mockImplementationOnce(() => {
            throw new GoogleError({ code: GoogleErrorCode.Refused })
        })

        await expect(service.complete(callback({ state: undefined }))).resolves.toEqual(location("error", "state"))
        await expect(service.complete(callback())).resolves.toEqual(location("error", "state"))
        expect(connections.authorize).not.toHaveBeenCalled()
    })

    it("hands a Drive consent to the Drive grant and answers drive=ok", async () => {
        const { service, google, drive } = await build()
        google.verify.mockReturnValueOnce({ ...state, p: DRIVE_PURPOSE })
        await expect(service.complete(callback())).resolves.toEqual(location("ok", undefined, "drive"))
        expect(drive.complete).toHaveBeenCalledWith("ws-1", "owner-1", "consent-code")
        expect(google.exchangeCode).not.toHaveBeenCalled()
    })

    it("returns unavailable for an unconfigured client", async () => {
        const { service, connections, google } = await build()
        google.isConfigured.mockReturnValue(false)
        await expect(service.complete(callback())).resolves.toEqual(location("error", "unavailable"))
        expect(connections.authorize).not.toHaveBeenCalled()
    })

    it("returns forbidden when the signed member no longer has access", async () => {
        const { service, connections, google } = await build()
        connections.authorize.mockRejectedValue(new Error("membership removed"))

        await expect(service.complete(callback())).resolves.toEqual(location("error", "forbidden"))
        expect(connections.authorize).toHaveBeenCalledWith(actor, ["owner", "manager"])
        expect(google.exchangeCode).not.toHaveBeenCalled()
    })

    it.each([
        { error: "access_denied", code: "consent-code", reason: "denied" },
        { error: "invalid_client", code: "consent-code", reason: "unavailable" },
        { error: "unexpected_refusal", code: "consent-code", reason: "failed" },
        { error: undefined, code: undefined, reason: "failed" },
    ])("maps an unsuccessful callback: %j", async ({ error, code, reason }) => {
        const { service, google } = await build()

        await expect(service.complete(callback({ error, code }))).resolves.toEqual(location("error", reason))
        expect(google.exchangeCode).not.toHaveBeenCalled()
    })

    it("updates the same account and seals the newly issued tokens", async () => {
        const { service, connections, google } = await build()
        connections.listByProvider.mockResolvedValue([
            record({ id: "other", meta: { email: "other@example.test" } }),
            record({ meta: { email: "shop@example.test", sheet_id: "existing-sheet" } }),
        ])

        await expect(service.complete(callback())).resolves.toEqual(location("ok"))
        expect(google.exchangeCode).toHaveBeenCalledWith("consent-code")
        expect(google.accountEmail).toHaveBeenCalledWith(tokens)
        expect(connections.patch).toHaveBeenCalledWith("ws-1", "c1", {
            name: "Google - shop@example.test",
            status: "connected",
            lastError: null,
            meta: { email: "shop@example.test", sheet_id: "existing-sheet" },
        })
        expect(connections.writeSecret).toHaveBeenCalledWith("c1", JSON.stringify(issued))
        expect(connections.readSecret).not.toHaveBeenCalled()
        expect(connections.create).not.toHaveBeenCalled()
    })
})

describe("GoogleConnectionsService / complete", () => {
    it("retains a same account's refresh token when Google does not issue another", async () => {
        const { service, connections, google } = await build()
        google.exchangeCode.mockResolvedValue({ ...tokens, refreshToken: null })

        await expect(service.complete(callback())).resolves.toEqual(location("ok"))
        expect(connections.writeSecret).toHaveBeenCalledWith(
            "c1",
            JSON.stringify({ access_token: "access-new", refresh_token: "refresh-old", expires_at: EXPIRES }),
        )
    })

    it("reuses a refused-consent row instead of creating another account", async () => {
        const { service, connections } = await build()
        connections.listByProvider.mockResolvedValue([
            record({ id: "pending", status: "pending", meta: {} }),
            record({ id: "unrelated", status: "error", lastError: null, meta: {} }),
            record({ id: "revoked", status: "error", lastError: "invalid_grant", meta: {} }),
            record({ id: "refused", status: "error", lastError: "consent:access_denied", meta: {} }),
        ])

        await expect(service.complete(callback())).resolves.toEqual(location("ok"))
        expect(connections.patch).toHaveBeenCalledWith("ws-1", "refused", {
            name: "Google - shop@example.test",
            status: "connected",
            lastError: null,
            meta: { email: "shop@example.test" },
        })
        expect(connections.create).not.toHaveBeenCalled()
    })

    it.each([
        { email: "new@example.test", accounts: [record()], name: "Google - new@example.test" },
        { email: null, accounts: [], name: "Google" },
    ])("creates a new account named $name", async ({ email, accounts, name }) => {
        const { service, connections, google } = await build()
        connections.listByProvider.mockResolvedValue(accounts)
        google.accountEmail.mockResolvedValue(email)

        await expect(service.complete(callback())).resolves.toEqual(location("ok"))
        expect(connections.create).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            createdBy: "owner-1",
            provider: "google",
            name,
            status: "connected",
            environment: "live",
            meta: { email: email ?? "" },
            secret: { plain: JSON.stringify(issued), webhookSecret: matching(/^[0-9a-f]{64}$/u) },
        })
        expect(connections.patch).not.toHaveBeenCalled()
    })

    it.each<Readonly<Record<string, string>>>([{ email: "old@example.test", extra: "kept" }, { extra: "kept" }])(
        "keeps refused-row metadata when an anonymous account consents: %j",
        async (meta) => {
            const { service, connections, google } = await build()
            connections.listByProvider.mockResolvedValue([
                record({ status: "error", lastError: "consent:invalid_client", meta }),
            ])
            google.accountEmail.mockResolvedValue(null)

            await expect(service.complete(callback())).resolves.toEqual(location("ok"))
            expect(connections.patch).toHaveBeenCalledWith("ws-1", "c1", {
                name: "Google",
                status: "connected",
                lastError: null,
                meta: { ...meta, email: meta.email ?? "" },
            })
        },
    )
})

describe("GoogleConnectionsService / complete", () => {
    it.each([null, "{}", "not-json", "null", '"text"'])(
        "returns no_refresh when the prior credential is %s",
        async (plain) => {
            const { service, connections, google } = await build()
            google.exchangeCode.mockResolvedValue({ ...tokens, refreshToken: null })
            connections.readSecret.mockResolvedValue(plain === null ? null : { plain, webhookSecret: "hook" })

            await expect(service.complete(callback())).resolves.toEqual(location("error", "no_refresh"))
            expect(connections.patch).not.toHaveBeenCalled()
        },
    )

    it("returns no_refresh for a new account that lacks a refresh token", async () => {
        const { service, connections, google } = await build()
        connections.listByProvider.mockResolvedValue([])
        google.exchangeCode.mockResolvedValue({ ...tokens, refreshToken: null })

        await expect(service.complete(callback())).resolves.toEqual(location("error", "no_refresh"))
        expect(connections.readSecret).not.toHaveBeenCalled()
        expect(connections.create).not.toHaveBeenCalled()
    })

    it("records a consent failure thrown by the token exchange and returns unavailable", async () => {
        const { service, connections, google } = await build()
        connections.listByProvider.mockResolvedValue([record({ status: "pending" })])
        google.exchangeCode.mockRejectedValue(googleRefusal({ reason: "invalid_client" }))

        await expect(service.complete(callback())).resolves.toEqual(location("error", "unavailable"))
        expect(connections.patch).toHaveBeenCalledWith("ws-1", "c1", {
            status: "error",
            lastError: "consent:invalid_client",
        })
    })

    it.each([
        new Error("network down"),
        googleRefusal({ reason: "server_error" }),
        googleRefusal(),
        new GoogleConnectionsError({ code: GoogleConnectionsErrorCode.Lost }),
    ])("returns failed for other exchange failures: %s", async (error) => {
        const { service, google } = await build()
        google.exchangeCode.mockRejectedValue(error)

        await expect(service.complete(callback())).resolves.toEqual(location("error", "failed"))
    })

    it("keeps a same-site return query and replaces an unsafe return path", async () => {
        const { service, google } = await build()
        google.verify.mockReturnValueOnce({ ...state, r: "/automations?tab=google&reason=old" })
        await expect(service.complete(callback())).resolves.toEqual({
            location: "https://nivo.vn/automations?tab=google&google=ok",
        })
        google.verify.mockReturnValue({ ...state, r: "https://other.test" })
        await expect(service.complete(callback())).resolves.toEqual(location("ok"))
    })
})

describe("GoogleConnectionsService / consent failure recording", () => {
    it("leaves a connected account intact and ignores errors unrelated to consent", async () => {
        const { service, connections } = await build()

        await expect(service.complete(callback({ error: "access_denied" }))).resolves.toEqual(
            location("error", "denied"),
        )
        await expect(service.complete(callback({ error: "server_error" }))).resolves.toEqual(
            location("error", "failed"),
        )
        expect(connections.listByProvider).toHaveBeenCalledTimes(1)
        expect(connections.patch).not.toHaveBeenCalled()
        expect(connections.create).not.toHaveBeenCalled()
    })

    it("updates the oldest live row after skipping disconnected records", async () => {
        const { service, connections } = await build()
        connections.listByProvider.mockResolvedValue([
            record({ id: "disconnected", status: "disconnected" }),
            record({ id: "pending", status: "pending" }),
        ])

        await expect(service.complete(callback({ error: "access_denied" }))).resolves.toEqual(
            location("error", "denied"),
        )
        expect(connections.patch).toHaveBeenCalledWith("ws-1", "pending", {
            status: "error",
            lastError: "consent:access_denied",
        })
    })

    it.each([{ rows: [record({ status: "pending" })] }, { rows: [] }])(
        "records refused consent after creating a pending row: %j",
        async ({ rows }) => {
            const { service, connections } = await build()
            connections.listByProvider.mockResolvedValueOnce([]).mockResolvedValueOnce(rows)

            await expect(service.complete(callback({ error: "invalid_client" }))).resolves.toEqual(
                location("error", "unavailable"),
            )
            expect(connections.create).toHaveBeenCalledWith({
                workspaceId: "ws-1",
                createdBy: "owner-1",
                provider: "google",
                name: "Google",
                status: "pending",
                environment: "live",
                meta: {},
                secret: { plain: "{}", webhookSecret: matching(/^[0-9a-f]{64}$/u) },
            })
            expect(connections.create).toHaveBeenCalledTimes(1)
            expect(connections.patch.mock.calls).toEqual(
                rows.length === 0 ? [] : [["ws-1", "c1", { status: "error", lastError: "consent:invalid_client" }]],
            )
        },
    )

    it("swallows persistence failures for callback and thrown consent refusals", async () => {
        const { service, connections, google } = await build()
        connections.listByProvider.mockRejectedValue(new Error("database down"))

        await expect(service.complete(callback({ error: "access_denied" }))).resolves.toEqual(
            location("error", "denied"),
        )
        google.exchangeCode.mockRejectedValue(googleRefusal({ reason: "invalid_client" }))
        await expect(service.complete(callback())).resolves.toEqual(location("error", "unavailable"))
    })
})

describe("GoogleConnectionsService / provisionOrdersSheet", () => {
    it("trims an existing spreadsheet id without consulting Google or the connection", async () => {
        const { service, connections, google } = await build()

        await expect(service.provisionOrdersSheet("ws-1", "Shop", { spreadsheetId: " sheet-1 " })).resolves.toEqual(
            sheet,
        )
        expect(connections.listByProvider).not.toHaveBeenCalled()
        expect(google.createOrdersSpreadsheet).not.toHaveBeenCalled()
    })

    it("creates a sheet with the selected account and saves its metadata", async () => {
        const { service, connections, google } = await build()
        connections.listByProvider.mockResolvedValue([
            record({ id: "other" }),
            record({ meta: { email: "shop@example.test", preserved: "yes" } }),
        ])

        await expect(
            service.provisionOrdersSheet("ws-1", "Shop", { spreadsheetId: " ", googleConnectionId: "c1" }),
        ).resolves.toEqual(sheet)
        expect(google.createOrdersSpreadsheet).toHaveBeenCalledWith("access-old", "Shop")
        expect(connections.patch).toHaveBeenCalledWith("ws-1", "c1", {
            meta: {
                email: "shop@example.test",
                preserved: "yes",
                sheet_id: "sheet-1",
                sheet_url: "https://docs.google.com/spreadsheets/d/sheet-1/edit",
            },
        })
    })

    it("bounds the spreadsheet title and returns it even if the connection disappears after creation", async () => {
        const { service, connections, google } = await build()
        connections.listByProvider.mockResolvedValueOnce([record()]).mockResolvedValueOnce([])

        await expect(service.provisionOrdersSheet("ws-1", "x".repeat(150), { spreadsheetId: 42 })).resolves.toEqual(
            sheet,
        )
        expect(google.createOrdersSpreadsheet).toHaveBeenCalledWith("access-old", "x".repeat(120))
        expect(connections.patch).not.toHaveBeenCalled()
    })
})

describe("GoogleConnectionsService / runSheetEvent and access tokens", () => {
    it.each<SheetConfig>([{}, { googleConnectionId: "" }, { googleConnectionId: 42 }])(
        "uses the oldest live account when no named account is configured: %j",
        async (config) => {
            const { service, connections, google } = await build()
            connections.listByProvider.mockResolvedValue([
                record({ id: "disconnected", status: "disconnected" }),
                record(),
            ])

            await expect(service.runSheetEvent("ws-1", config, event)).resolves.toEqual({
                evidence: "Recorded O-1",
            })
            expect(connections.readSecret).toHaveBeenCalledWith("c1")
            expect(google.applyEvent).toHaveBeenCalledWith("access-old", config, event)
            expect(google.refreshAccessToken).not.toHaveBeenCalled()
        },
    )

    it("refuses sheet work when Google is unconfigured", async () => {
        const { service, connections, google } = await build()
        google.isConfigured.mockReturnValue(false)

        await expect(service.runSheetEvent("ws-1", {}, event)).rejects.toEqual(
            new GoogleConnectionsError({ code: GoogleConnectionsErrorCode.NotConfigured }),
        )
        expect(connections.listByProvider).not.toHaveBeenCalled()
    })

    it.each<{ rows: ReadonlyArray<ConnectionRecord> }>([
        { rows: [] },
        { rows: [record({ status: "pending" })] },
        { rows: [record({ id: "other" })] },
    ])("refuses an absent or pending named connection: %j", async ({ rows }) => {
        const { service, connections, google } = await build()
        connections.listByProvider.mockResolvedValue(rows)

        await expect(service.runSheetEvent("ws-1", { googleConnectionId: "c1" }, event)).rejects.toEqual(
            new GoogleConnectionsError({ code: GoogleConnectionsErrorCode.Missing }),
        )
        expect(google.applyEvent).not.toHaveBeenCalled()
    })

    it.each([
        ["consent:access_denied", GoogleConnectionsErrorCode.NotConfigured],
        ["invalid_grant", GoogleConnectionsErrorCode.Lost],
        [null, GoogleConnectionsErrorCode.Lost],
    ])("reports an error connection's last refusal %s", async (lastError, code) => {
        const { service, connections } = await build()
        connections.listByProvider.mockResolvedValue([record({ status: "error", lastError })])

        await expect(service.runSheetEvent("ws-1", {}, event)).rejects.toEqual(new GoogleConnectionsError({ code }))
        expect(connections.readSecret).not.toHaveBeenCalled()
    })

    it.each([null, "{}", "bad-json", "null", "123", '{"refresh_token":""}'])(
        "refuses credentials without a refresh token: %s",
        async (plain) => {
            const { service, connections, google } = await build()
            connections.readSecret.mockResolvedValue(plain === null ? null : { plain, webhookSecret: "hook" })

            await expect(service.runSheetEvent("ws-1", {}, event)).rejects.toEqual(
                new GoogleConnectionsError({ code: GoogleConnectionsErrorCode.Lost }),
            )
            expect(google.refreshAccessToken).not.toHaveBeenCalled()
        },
    )
})

describe("GoogleConnectionsService / runSheetEvent and access tokens", () => {
    it.each([
        { ...stored, expires_at: NOW.getTime() + 90_000 },
        { refresh_token: "refresh-old", expires_at: EXPIRES },
        { access_token: "access-old", refresh_token: "refresh-old" },
    ])("refreshes expired, missing-access and missing-expiry tokens: %j", async (credential) => {
        const { service, connections, google } = await build()
        connections.readSecret.mockResolvedValue({ plain: JSON.stringify(credential), webhookSecret: "hook" })

        await expect(service.runSheetEvent("ws-1", {}, event)).resolves.toEqual({ evidence: "Recorded O-1" })
        expect(google.refreshAccessToken).toHaveBeenCalledWith("refresh-old")
        expect(connections.writeSecret).toHaveBeenCalledWith("c1", JSON.stringify(issued))
        expect(google.applyEvent).toHaveBeenCalledWith("access-new", {}, event)
    })

    it("forces one token refresh and retries the same sheet event after a 401", async () => {
        const { service, connections, google } = await build()
        google.applyEvent
            .mockRejectedValueOnce(googleRefusal({ status: 401 }))
            .mockResolvedValueOnce({ evidence: "Retried O-1" })
        const config = { googleConnectionId: "c1", spreadsheetId: "sheet-1" }

        await expect(service.runSheetEvent("ws-1", config, event)).resolves.toEqual({ evidence: "Retried O-1" })
        expect(google.applyEvent.mock.calls).toEqual([
            ["access-old", config, event],
            ["access-new", config, event],
        ])
        expect(google.refreshAccessToken).toHaveBeenCalledTimes(1)
        expect(connections.readSecret).toHaveBeenCalledTimes(2)
    })

    it.each([
        { error: new Error("sheet down"), attempts: 1, refreshes: 0 },
        { error: googleRefusal({ status: 403 }), attempts: 1, refreshes: 0 },
        { error: googleRefusal(), attempts: 1, refreshes: 0 },
        { error: googleRefusal({ status: 401 }), attempts: 2, refreshes: 1 },
    ])("propagates a sheet failure with bounded attempts: %j", async ({ error, attempts, refreshes }) => {
        const { service, google } = await build()
        google.applyEvent.mockRejectedValue(error)

        await expect(service.runSheetEvent("ws-1", {}, event)).rejects.toBe(error)
        expect(google.applyEvent).toHaveBeenCalledTimes(attempts)
        expect(google.refreshAccessToken).toHaveBeenCalledTimes(refreshes)
    })

    it("marks a revoked refresh token as invalid_grant and reports the connection lost", async () => {
        const { service, connections, google } = await build()
        connections.readSecret.mockResolvedValue({
            plain: JSON.stringify({ ...stored, expires_at: NOW.getTime() }),
            webhookSecret: "hook",
        })
        google.refreshAccessToken.mockRejectedValue(googleRefusal({ reason: "invalid_grant" }))

        await expect(service.runSheetEvent("ws-1", {}, event)).rejects.toEqual(
            new GoogleConnectionsError({ code: GoogleConnectionsErrorCode.Lost }),
        )
        expect(connections.patch).toHaveBeenCalledWith("ws-1", "c1", {
            status: "error",
            lastError: "invalid_grant",
        })
        expect(google.applyEvent).not.toHaveBeenCalled()
    })
})

describe("GoogleConnectionsService / runSheetEvent and access tokens", () => {
    it.each([new Error("token endpoint down"), googleRefusal({ reason: "server_error" })])(
        "propagates other token-refresh failures: %s",
        async (error) => {
            const { service, connections, google } = await build()
            connections.readSecret.mockResolvedValue({
                plain: JSON.stringify({ ...stored, expires_at: NOW.getTime() }),
                webhookSecret: "hook",
            })
            google.refreshAccessToken.mockRejectedValue(error)

            await expect(service.runSheetEvent("ws-1", {}, event)).rejects.toBe(error)
            expect(connections.patch).not.toHaveBeenCalled()
        },
    )
})
