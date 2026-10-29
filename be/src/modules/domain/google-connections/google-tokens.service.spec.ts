import { FakeClock, mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { ConnectionsService } from "@modules/domain/connections"
import type { ConnectionRecord } from "@modules/domain/connections"
import { GOOGLE_CLIENT, GOOGLE_SCOPE, GoogleError, GoogleErrorCode } from "@modules/integrations/google"
import type { GoogleClient } from "@modules/integrations/google"
import { CLOCK } from "@modules/platform/clock"
import { GoogleConnectionsError, GoogleConnectionsErrorCode } from "./errors/google-connections.error"
import { GoogleTokensService } from "./google-tokens.service"
import { stored, tokens, tokensWithoutRenewal } from "@tests/fixtures/builders/google-connections.builder"

const NOW = new Date("2026-10-12T03:00:00.000Z")
const EXPIRES = NOW.getTime() + 3_600_000

const record = (overrides: Partial<ConnectionRecord> = {}): ConnectionRecord => ({
    id: "c1",
    workspaceId: "ws-1",
    provider: "google",
    name: "Google",
    meta: {},
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
    connections.readSecret.mockResolvedValue({ plain: JSON.stringify(stored), webhookSecret: "hook-1" })
    connections.create.mockResolvedValue("c1")
    const google = mock<GoogleClient>()
    google.isConfigured.mockReturnValue(true)
    google.sign.mockReturnValue("signed-state")
    google.authUrl.mockReturnValue("https://google.test/auth")
    google.refreshAccessToken.mockResolvedValue(tokens)
    const moduleRef = await Test.createTestingModule({
        providers: [
            GoogleTokensService,
            { provide: ConnectionsService, useValue: connections },
            { provide: GOOGLE_CLIENT, useValue: google },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
        ],
    }).compile()
    return { service: moduleRef.get(GoogleTokensService), connections, google }
}

describe("GoogleTokensService", () => {
    it("signs a same-site state with its purpose and answers the consent url", async () => {
        const { service, google } = await build()

        expect(
            service.consent({
                actor: { principalId: "u1", workspaceId: "ws-1" },
                returnTo: "https://evil.test",
                scope: GOOGLE_SCOPE,
                purpose: "drive_read",
            }),
        ).toEqual({ url: "https://google.test/auth" })
        expect(google.sign).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            userId: "u1",
            returnTo: "/connections",
            purpose: "drive_read",
        })
        expect(google.authUrl).toHaveBeenCalledWith("signed-state", GOOGLE_SCOPE)
    })

    it("keeps the stored refresh token when a consent brings none", async () => {
        const { service } = await build()

        await expect(service.keptRefresh(record(), null)).resolves.toBe("refresh-old")
        await expect(service.keptRefresh(record(), "refresh-new")).resolves.toBe("refresh-new")
        await expect(service.keptRefresh(null, null)).resolves.toBeNull()
    })

    it("updates an existing row and creates a missing one", async () => {
        const { service, connections } = await build()
        const save = { workspaceId: "ws-1", userId: "u1", provider: "google" as const, name: "Google", meta: {} }

        await service.save({ ...save, row: record(), tokens: stored })
        expect(connections.patch).toHaveBeenCalledWith("ws-1", "c1", {
            name: "Google",
            status: "connected",
            lastError: null,
            meta: {},
        })
        expect(connections.writeSecret).toHaveBeenCalledWith("c1", JSON.stringify(stored))
        await service.save({ ...save, row: null, tokens: stored })
        expect(connections.create).toHaveBeenCalledWith(
            expect.objectContaining({ provider: "google", status: "connected" }),
        )
    })

    it("answers a fresh stored token, refreshes an expiring one and keeps the refresh token Google omits", async () => {
        const { service, connections, google } = await build()

        await expect(service.accessToken({ row: record(), force: false })).resolves.toBe("access-old")
        expect(google.refreshAccessToken).not.toHaveBeenCalled()
        google.refreshAccessToken.mockResolvedValue(tokensWithoutRenewal)
        await expect(service.accessToken({ row: record(), force: true })).resolves.toBe("access-new")
        expect(connections.writeSecret).toHaveBeenCalledWith(
            "c1",
            JSON.stringify({ access_token: "access-new", renewal_token: "refresh-old", expires_at: EXPIRES }),
        )
    })

    it("marks a revoked refresh token lost", async () => {
        const { service, connections, google } = await build()
        google.refreshAccessToken.mockRejectedValue(
            new GoogleError({ code: GoogleErrorCode.Refused, params: { reason: "invalid_grant" } }),
        )

        await expect(service.accessToken({ row: record(), force: true })).rejects.toEqual(
            new GoogleConnectionsError({ code: GoogleConnectionsErrorCode.Lost }),
        )
        expect(connections.patch).toHaveBeenCalledWith("ws-1", "c1", { status: "error", lastError: "invalid_grant" })
    })
})

describe("GoogleTokensService", () => {
    it("retries once with a forced token when the first is refused", async () => {
        const { service } = await build()
        const token = jest.fn((force: boolean) => Promise.resolve(force ? "fresh" : "old"))
        const work = jest
            .fn()
            .mockRejectedValueOnce(new GoogleError({ code: GoogleErrorCode.Refused, params: { status: 401 } }))
            .mockResolvedValueOnce("done")

        await expect(service.withRetry(token, work, () => true)).resolves.toBe("done")
        expect(work).toHaveBeenLastCalledWith("fresh")
    })
})
