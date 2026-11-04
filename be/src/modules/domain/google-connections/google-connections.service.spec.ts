import { FakeClock, mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { ConnectionsService } from "@modules/domain/connections"
import {
    DRIVE_PURPOSE,
    GOOGLE_CLIENT,
    GOOGLE_SCOPE,
    GoogleError,
    GoogleErrorCode,
    SHEETS_PURPOSE,
} from "@modules/integrations/google"
import type { GoogleClient } from "@modules/integrations/google"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { DriveGrantService } from "./drive-grant.service"
import { GoogleConnectionsService } from "./google-connections.service"
import { GoogleTokensService } from "./google-tokens.service"
import { SheetsGrantService } from "./sheets-grant.service"
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
    record,
    googleRefusal,
    callback,
    location,
    tokensWithoutRenewal,
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
    const drive = mock<DriveGrantService>()
    drive.complete.mockResolvedValue(undefined)
    const sheets = mock<SheetsGrantService>()
    sheets.complete.mockResolvedValue(undefined)
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
            { provide: SheetsGrantService, useValue: sheets },
        ],
    }).compile()
    return { service: moduleRef.get(GoogleConnectionsService), connections, google, drive, sheets }
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
        await expect(service.state(actor)).resolves.toEqual({ configured: false, consentNeeded: false })
        await expect(service.accounts(actor)).resolves.toEqual([
            { id: "c1", email: "shop@example.test", status: "connected", consentNeeded: false },
            { id: "c2", email: "", status: "error", consentNeeded: false },
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

describe("GoogleConnectionsService / the connection the seed made", () => {
    const seeded = record({
        id: "seeded",
        status: "pending",
        name: "Google",
        meta: { oauth_client_id: "client-1", consent: "needed" },
    })

    it("says the workspace still waits for the owner to consent, and which account row it is", async () => {
        const { service, connections } = await build()
        connections.listByProvider.mockResolvedValue([seeded])

        await expect(service.state(actor)).resolves.toEqual({ configured: true, consentNeeded: true })
        await expect(service.accounts(actor)).resolves.toEqual([
            { id: "seeded", email: "", status: "pending", consentNeeded: true },
        ])
    })

    it("fills that row with the first consent, keeps its client id and marks the consent given", async () => {
        const { service, connections } = await build()
        connections.listByProvider.mockResolvedValue([seeded])
        connections.readSecret.mockResolvedValue({
            plain: JSON.stringify({ oauth_client_id: "client-1", oauth_client_secret: "never-a-token" }),
            webhookSecret: "hook-1",
        })

        await expect(service.complete(callback())).resolves.toEqual(location("ok"))
        expect(connections.patch).toHaveBeenCalledWith("ws-1", "seeded", {
            name: "Google - shop@example.test",
            status: "connected",
            lastError: null,
            meta: { oauth_client_id: "client-1", email: "shop@example.test", consent: "given" },
        })
        expect(connections.writeSecret).toHaveBeenCalledWith("seeded", JSON.stringify(issued))
        expect(connections.create).not.toHaveBeenCalled()
    })
})

describe("GoogleConnectionsService / complete", () => {
    it("hands a ledger consent to the Sheets grant and answers sheets=ok", async () => {
        const { service, google, drive, sheets } = await build()
        google.verify.mockReturnValueOnce({ ...state, p: SHEETS_PURPOSE })

        await expect(service.complete(callback())).resolves.toEqual(location("ok", undefined, "sheets"))
        expect(sheets.complete).toHaveBeenCalledWith("ws-1", "owner-1", "consent-code")
        expect(drive.complete).not.toHaveBeenCalled()
        expect(google.exchangeCode).not.toHaveBeenCalled()
    })

    it("answers sheets=error without recording a failure on the connection when the ledger consent is refused", async () => {
        const { service, google, connections } = await build()
        google.verify.mockReturnValueOnce({ ...state, p: SHEETS_PURPOSE })

        await expect(service.complete(callback({ error: "access_denied", code: undefined }))).resolves.toEqual(
            location("error", "denied", "sheets"),
        )
        expect(connections.patch).not.toHaveBeenCalled()
        expect(connections.create).not.toHaveBeenCalled()
    })

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
})

describe("GoogleConnectionsService / complete for an account it knows", () => {
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
        google.exchangeCode.mockResolvedValue(tokensWithoutRenewal)

        await expect(service.complete(callback())).resolves.toEqual(location("ok"))
        expect(connections.writeSecret).toHaveBeenCalledWith(
            "c1",
            JSON.stringify({ access_token: "access-new", renewal_token: "refresh-old", expires_at: EXPIRES }),
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
            google.exchangeCode.mockResolvedValue(tokensWithoutRenewal)
            connections.readSecret.mockResolvedValue(plain === null ? null : { plain, webhookSecret: "hook" })

            await expect(service.complete(callback())).resolves.toEqual(location("error", "no_refresh"))
            expect(connections.patch).not.toHaveBeenCalled()
        },
    )

    it("returns no_refresh for a new account that lacks a refresh token", async () => {
        const { service, connections, google } = await build()
        connections.listByProvider.mockResolvedValue([])
        google.exchangeCode.mockResolvedValue(tokensWithoutRenewal)

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
