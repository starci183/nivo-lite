import { FakeClock, mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { ConnectionsService } from "@modules/domain/connections"
import type { ConnectionRecord } from "@modules/domain/connections"
import { GOOGLE_CLIENT } from "@modules/integrations/google"
import type { GoogleClient, SheetConfig } from "@modules/integrations/google"
import { GoogleConnectionsError, GoogleConnectionsErrorCode } from "./errors/google-connections.error"
import { GoogleSheetsService } from "./google-sheets.service"
import { GoogleTokensService } from "./google-tokens.service"
import { runRealGoogleTokens } from "@tests/fixtures/builders/google-tokens.builder"
import {
    NOW,
    EXPIRES,
    tokens,
    stored,
    issued,
    event,
    sheet,
    record,
    googleRefusal,
} from "@tests/fixtures/builders/google-connections.builder"

const build = async () => {
    const connections = mock<ConnectionsService>()
    connections.listByProvider.mockResolvedValue([record()])
    connections.readSecret.mockResolvedValue({ plain: JSON.stringify(stored), webhookSecret: "hook-1" })
    const google = mock<GoogleClient>()
    google.isConfigured.mockReturnValue(true)
    google.refreshAccessToken.mockResolvedValue(tokens)
    google.createOrdersSpreadsheet.mockResolvedValue(sheet)
    google.applyEvent.mockResolvedValue({ evidence: "Recorded O-1" })
    const tokenStore = mock<GoogleTokensService>()
    runRealGoogleTokens(tokenStore, connections, google, new FakeClock(NOW))
    const moduleRef = await Test.createTestingModule({
        providers: [
            GoogleSheetsService,
            { provide: ConnectionsService, useValue: connections },
            { provide: GOOGLE_CLIENT, useValue: google },
            { provide: GoogleTokensService, useValue: tokenStore },
        ],
    }).compile()
    return { service: moduleRef.get(GoogleSheetsService), connections, google }
}

describe("GoogleSheetsService / provisionOrdersSheet", () => {
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

describe("GoogleSheetsService / runSheetEvent and account choice", () => {
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

    it.each([null, "{}", "bad-json", "null", "123", '{"renewal_token":""}'])(
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

describe("GoogleSheetsService / runSheetEvent token refresh", () => {
    it.each([
        { ...stored, expires_at: NOW.getTime() + 90_000 },
        { renewal_token: "refresh-old", expires_at: EXPIRES },
        { access_token: "access-old", renewal_token: "refresh-old" },
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

describe("GoogleSheetsService / runSheetEvent refresh failures", () => {
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
