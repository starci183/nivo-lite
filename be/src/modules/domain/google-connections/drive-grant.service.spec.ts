import { FakeClock, mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { ConnectionsService } from "@modules/domain/connections"
import type { ConnectionActor, ConnectionRecord } from "@modules/domain/connections"
import { DocumentsError, DocumentsErrorCode } from "@modules/integrations/documents"
import {
    DRIVE_PURPOSE,
    DRIVE_READ_SCOPE,
    GOOGLE_CLIENT,
    GoogleError,
    GoogleErrorCode,
} from "@modules/integrations/google"
import type { GoogleClient, GoogleTokenSet } from "@modules/integrations/google"
import { DriveGrantService } from "./drive-grant.service"
import { GoogleConnectionsError, GoogleConnectionsErrorCode } from "./errors/google-connections.error"
import { GoogleTokensService } from "./google-tokens.service"
import { runRealGoogleTokens } from "@tests/fixtures/builders/google-tokens.builder"

const actor: ConnectionActor = { principalId: "owner-1", workspaceId: "ws-1" }
const NOW = new Date("2026-10-12T03:00:00.000Z")
const EXPIRES = NOW.getTime() + 3_600_000
const tokens: GoogleTokenSet = {
    accessToken: "access-new",
    refreshToken: "refresh-new",
    expiresAt: EXPIRES,
    idToken: null,
    scope: DRIVE_READ_SCOPE,
}
const stored = { access_token: "access-old", refresh_token: "refresh-old", expires_at: EXPIRES }

const record = (overrides: Partial<ConnectionRecord> = {}): ConnectionRecord => ({
    id: "d1",
    workspaceId: "ws-1",
    provider: "google_drive",
    name: "Google Drive - shop@example.test",
    meta: { email: "shop@example.test" },
    status: "connected",
    lastError: null,
    environment: "live",
    isDefault: false,
    lastEventAt: null,
    firstEvent: null,
    createdBy: "owner-1",
    createdAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
})

const build = async () => {
    const connections = mock<ConnectionsService>()
    connections.authorize.mockResolvedValue({ role: "owner", displayName: "Lan" })
    connections.listByProvider.mockResolvedValue([record()])
    connections.readSecret.mockResolvedValue({ plain: JSON.stringify(stored), webhookSecret: "hook-1" })
    connections.create.mockResolvedValue("d1")
    const google = mock<GoogleClient>()
    google.isConfigured.mockReturnValue(true)
    google.sign.mockReturnValue("signed-state")
    google.authUrl.mockReturnValue("https://google.test/auth?state=signed-state")
    google.exchangeCode.mockResolvedValue(tokens)
    google.accountEmail.mockResolvedValue("shop@example.test")
    google.refreshAccessToken.mockResolvedValue(tokens)
    const tokenStore = mock<GoogleTokensService>()
    runRealGoogleTokens(tokenStore, connections, google, new FakeClock(NOW))
    const moduleRef = await Test.createTestingModule({
        providers: [
            DriveGrantService,
            { provide: ConnectionsService, useValue: connections },
            { provide: GOOGLE_CLIENT, useValue: google },
            { provide: GoogleTokensService, useValue: tokenStore },
        ],
    }).compile()
    return { service: moduleRef.get(DriveGrantService), connections, google }
}

describe("DriveGrantService", () => {
    describe("grant, authorize and disconnect", () => {
        it("answers the grant of the workspace for an owner or a manager", async () => {
            const { service, connections } = await build()

            await expect(service.grant(actor)).resolves.toEqual({ state: "connected", email: "shop@example.test" })
            expect(connections.authorize).toHaveBeenCalledWith(actor, ["owner", "manager"])
            expect(connections.listByProvider).toHaveBeenCalledWith("ws-1", "google_drive", {
                includeDisconnected: false,
            })
        })

        it("answers none without a row and lost for a revoked grant", async () => {
            const { service, connections } = await build()
            connections.listByProvider.mockResolvedValueOnce([])
            await expect(service.grant(actor)).resolves.toEqual({ state: "none", email: "" })
            connections.listByProvider.mockResolvedValueOnce([record({ status: "error", lastError: "invalid_grant" })])
            await expect(service.grant(actor)).resolves.toEqual({ state: "lost", email: "shop@example.test" })
        })

        it("signs the drive purpose and asks for the Drive read scope", async () => {
            const { service, google } = await build()

            await expect(service.authorize(actor, "/brain?tab=add")).resolves.toEqual({
                url: "https://google.test/auth?state=signed-state",
            })
            expect(google.sign).toHaveBeenCalledWith({
                workspaceId: "ws-1",
                userId: "owner-1",
                returnTo: "/brain?tab=add",
                purpose: DRIVE_PURPOSE,
            })
            expect(google.authUrl).toHaveBeenCalledWith("signed-state", DRIVE_READ_SCOPE)
        })

        it("refuses to start when Google is not configured", async () => {
            const { service, google } = await build()
            google.isConfigured.mockReturnValue(false)

            await expect(service.authorize(actor, "/brain")).rejects.toEqual(
                new GoogleConnectionsError({ code: GoogleConnectionsErrorCode.NotConfigured }),
            )
        })

        it("deletes every grant row of the workspace", async () => {
            const { service, connections } = await build()
            connections.listByProvider.mockResolvedValueOnce([record(), record({ id: "d2", status: "disconnected" })])

            await service.disconnect(actor)
            expect(connections.remove).toHaveBeenCalledWith("ws-1", "d1")
            expect(connections.remove).toHaveBeenCalledWith("ws-1", "d2")
        })
    })

    describe("complete", () => {
        it("creates the grant connection the first time", async () => {
            const { service, connections } = await build()
            connections.listByProvider.mockResolvedValue([])

            await service.complete("ws-1", "owner-1", "code-1")
            expect(connections.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    provider: "google_drive",
                    name: "Google Drive - shop@example.test",
                    status: "connected",
                    meta: { email: "shop@example.test" },
                }),
            )
        })

        it("keeps the old refresh token when Google sends none", async () => {
            const { service, connections, google } = await build()
            google.exchangeCode.mockResolvedValue({ ...tokens, refreshToken: null })

            await service.complete("ws-1", "owner-1", "code-1")
            expect(connections.writeSecret).toHaveBeenCalledWith(
                "d1",
                JSON.stringify({ access_token: "access-new", refresh_token: "refresh-old", expires_at: EXPIRES }),
            )
        })

        it("refuses a consent without the Drive scope and one without any refresh token", async () => {
            const { service, connections, google } = await build()
            google.exchangeCode.mockResolvedValueOnce({ ...tokens, scope: "openid email" })
            await expect(service.complete("ws-1", "owner-1", "code-1")).rejects.toEqual(
                new GoogleConnectionsError({ code: GoogleConnectionsErrorCode.ScopeMissing }),
            )
            connections.listByProvider.mockResolvedValue([])
            google.exchangeCode.mockResolvedValueOnce({ ...tokens, refreshToken: null })
            await expect(service.complete("ws-1", "owner-1", "code-1")).rejects.toEqual(
                new GoogleConnectionsError({ code: GoogleConnectionsErrorCode.Missing }),
            )
        })
    })

    describe("forWorkspace", () => {
        it("uses a fresh stored token without refreshing", async () => {
            const { service, google } = await build()
            const use = jest.fn().mockResolvedValue("listed")

            await expect(service.forWorkspace("ws-1").withToken(use)).resolves.toBe("listed")
            expect(use).toHaveBeenCalledWith("access-old")
            expect(google.refreshAccessToken).not.toHaveBeenCalled()
        })

        it("refreshes once and retries when Drive refuses the token", async () => {
            const { service } = await build()
            const use = jest
                .fn()
                .mockRejectedValueOnce(new DocumentsError({ code: DocumentsErrorCode.TokenRejected }))
                .mockResolvedValueOnce("listed")

            await expect(service.forWorkspace("ws-1").withToken(use)).resolves.toBe("listed")
            expect(use).toHaveBeenLastCalledWith("access-new")
        })

        it("marks a revoked grant lost", async () => {
            const { service, connections, google } = await build()
            connections.readSecret.mockResolvedValue({
                plain: JSON.stringify({ ...stored, expires_at: 0 }),
                webhookSecret: "hook-1",
            })
            google.refreshAccessToken.mockRejectedValue(
                new GoogleError({ code: GoogleErrorCode.Refused, params: { reason: "invalid_grant" } }),
            )

            await expect(service.forWorkspace("ws-1").withToken(jest.fn())).rejects.toEqual(
                new DocumentsError({ code: DocumentsErrorCode.DriveGrantLost }),
            )
            expect(connections.patch).toHaveBeenCalledWith("ws-1", "d1", {
                status: "error",
                lastError: "invalid_grant",
            })
        })

        it("answers the missing grant as a typed documents error and the state as none", async () => {
            const { service, connections } = await build()
            connections.listByProvider.mockResolvedValue([])

            await expect(service.forWorkspace("ws-1").state()).resolves.toBe("none")
            await expect(service.forWorkspace("ws-1").withToken(jest.fn())).rejects.toEqual(
                new DocumentsError({ code: DocumentsErrorCode.DriveGrantMissing }),
            )
        })
    })
})
