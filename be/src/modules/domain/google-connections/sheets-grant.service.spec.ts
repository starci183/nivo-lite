import { FakeClock, mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { ConnectionsService } from "@modules/domain/connections"
import { GOOGLE_CLIENT, SHEETS_PURPOSE, SHEETS_SCOPE } from "@modules/integrations/google"
import type { GoogleClient } from "@modules/integrations/google"
import { GoogleConnectionsError, GoogleConnectionsErrorCode } from "./errors/google-connections.error"
import { GoogleTokensService } from "./google-tokens.service"
import { SheetsGrantService } from "./sheets-grant.service"
import { runRealGoogleTokens } from "@tests/fixtures/builders/google-tokens.builder"
import { actor, EXPIRES, NOW, record, stored, tokens } from "@tests/fixtures/builders/google-connections.builder"

const SHEET = "1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789"
const LINK = `https://docs.google.com/spreadsheets/d/${SHEET}/edit#gid=0`

const build = async () => {
    const connections = mock<ConnectionsService>()
    connections.authorize.mockResolvedValue({ role: "owner", displayName: "Lan" })
    connections.listByProvider.mockResolvedValue([record()])
    connections.readSecret.mockResolvedValue({ plain: JSON.stringify(stored), webhookSecret: "hook-1" })
    connections.create.mockResolvedValue("c2")
    const google = mock<GoogleClient>()
    google.isConfigured.mockReturnValue(true)
    google.sign.mockReturnValue("signed-state")
    google.authUrl.mockReturnValue("https://google.test/auth?state=signed-state")
    google.exchangeCode.mockResolvedValue({
        ...tokens,
        scope: "openid email https://www.googleapis.com/auth/spreadsheets",
    })
    google.accountEmail.mockResolvedValue("shop@example.test")
    const store = mock<GoogleTokensService>()
    runRealGoogleTokens(store, connections, google, new FakeClock(NOW))
    const moduleRef = await Test.createTestingModule({
        providers: [
            SheetsGrantService,
            { provide: ConnectionsService, useValue: connections },
            { provide: GOOGLE_CLIENT, useValue: google },
            { provide: GoogleTokensService, useValue: store },
        ],
    }).compile()
    return { service: moduleRef.get(SheetsGrantService), connections, google }
}

describe("SheetsGrantService > authorize", () => {
    it("asks the owner for the spreadsheets scope, with the ledger purpose in the signed state", async () => {
        const { service, connections, google } = await build()

        await expect(service.authorize(actor, "/connections")).resolves.toEqual({
            url: "https://google.test/auth?state=signed-state",
        })
        expect(connections.authorize).toHaveBeenCalledWith(actor, ["owner"])
        expect(google.sign).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            userId: "owner-1",
            returnTo: "/connections",
            purpose: SHEETS_PURPOSE,
        })
        expect(google.authUrl).toHaveBeenCalledWith("signed-state", SHEETS_SCOPE)
    })

    it("refuses a deployment without Google", async () => {
        const { service, google } = await build()
        google.isConfigured.mockReturnValue(false)

        await expect(service.authorize(actor, "/connections")).rejects.toEqual(
            new GoogleConnectionsError({ code: GoogleConnectionsErrorCode.NotConfigured }),
        )
    })
})

describe("SheetsGrantService > complete", () => {
    it("marks the connection of the account that consented as having given the spreadsheets access, keeping the rest of its facts", async () => {
        const { service, connections } = await build()
        connections.listByProvider.mockResolvedValue([
            record({ meta: { email: "shop@example.test", sheet_id: "orders" } }),
        ])

        await service.complete("ws-1", "owner-1", "consent-code")

        expect(connections.patch).toHaveBeenCalledWith("ws-1", "c1", {
            name: "Google - shop@example.test",
            status: "connected",
            lastError: null,
            meta: { email: "shop@example.test", sheet_id: "orders", sheets: "granted" },
        })
        expect(connections.writeSecret).toHaveBeenCalledWith(
            "c1",
            JSON.stringify({ access_token: "access-new", renewal_token: "refresh-new", expires_at: EXPIRES }),
        )
    })

    it("fills the connection the seed made while it waited for the first consent", async () => {
        const { service, connections } = await build()
        connections.listByProvider.mockResolvedValue([
            record({ id: "seeded", status: "pending", meta: { oauth_client_id: "client-1", consent: "needed" } }),
        ])

        await service.complete("ws-1", "owner-1", "consent-code")

        expect(connections.patch).toHaveBeenCalledWith("ws-1", "seeded", {
            name: "Google - shop@example.test",
            status: "connected",
            lastError: null,
            meta: { oauth_client_id: "client-1", email: "shop@example.test", consent: "given", sheets: "granted" },
        })
        expect(connections.create).not.toHaveBeenCalled()
    })

    it("creates the connection of a new account with the access given", async () => {
        const { service, connections } = await build()
        connections.listByProvider.mockResolvedValue([])

        await service.complete("ws-1", "owner-1", "consent-code")

        expect(connections.create).toHaveBeenCalledWith(
            expect.objectContaining({
                provider: "google",
                status: "connected",
                meta: { email: "shop@example.test", sheets: "granted" },
            }),
        )
    })

    it("refuses a consent where the owner unticked the spreadsheets access, writing nothing", async () => {
        const { service, connections, google } = await build()
        google.exchangeCode.mockResolvedValue({
            ...tokens,
            scope: "openid email https://www.googleapis.com/auth/drive.file",
        })

        await expect(service.complete("ws-1", "owner-1", "consent-code")).rejects.toEqual(
            new GoogleConnectionsError({ code: GoogleConnectionsErrorCode.SheetsScopeMissing }),
        )
        expect(connections.patch).not.toHaveBeenCalled()
        expect(connections.create).not.toHaveBeenCalled()
    })

    it("refuses a consent that gives no refresh token when none is kept", async () => {
        const { service, connections, google } = await build()
        connections.listByProvider.mockResolvedValue([])
        google.exchangeCode.mockResolvedValue({ ...tokens, renewalToken: null })

        await expect(service.complete("ws-1", "owner-1", "consent-code")).rejects.toEqual(
            new GoogleConnectionsError({ code: GoogleConnectionsErrorCode.Missing }),
        )
    })
})

describe("SheetsGrantService > complete, an account Google did not name", () => {
    it("names the connection of an account Google did not name after the email its waiting row holds", async () => {
        const { service, connections, google } = await build()
        google.accountEmail.mockResolvedValue(null)
        connections.listByProvider.mockResolvedValue([
            record({ status: "pending", meta: { email: "kept@example.test", consent: "needed" } }),
        ])

        await service.complete("ws-1", "owner-1", "consent-code")

        expect(connections.patch).toHaveBeenCalledWith(
            "ws-1",
            "c1",
            expect.objectContaining({
                name: "Google - kept@example.test",
                meta: { email: "kept@example.test", consent: "given", sheets: "granted" },
            }),
        )
    })

    it("creates the connection of an account nobody named as plain Google", async () => {
        const { service, connections, google } = await build()
        google.accountEmail.mockResolvedValue(null)
        connections.listByProvider.mockResolvedValue([])

        await service.complete("ws-1", "owner-1", "consent-code")

        expect(connections.create).toHaveBeenCalledWith(
            expect.objectContaining({ provider: "google", name: "Google", meta: { email: "", sheets: "granted" } }),
        )
    })
})

describe("SheetsGrantService > setLedgerSheet", () => {
    const withAccess = (overrides = {}) =>
        record({ meta: { email: "shop@example.test", sheets: "granted" }, ...overrides })

    it("names the sheet from its link on the connection that gave the access, and answers where the ledger stands", async () => {
        const { service, connections } = await build()
        connections.listByProvider
            .mockResolvedValueOnce([withAccess()])
            .mockResolvedValueOnce([
                withAccess({ meta: { email: "shop@example.test", sheets: "granted", ledgerSheet: SHEET } }),
            ])

        await expect(service.setLedgerSheet(actor, LINK)).resolves.toEqual({
            state: "ready",
            email: "shop@example.test",
            sheetId: SHEET,
            sheetUrl: `https://docs.google.com/spreadsheets/d/${SHEET}/edit`,
            sheetTitle: "",
            lastRowAt: "",
        })
        expect(connections.authorize).toHaveBeenCalledWith(actor, ["owner"])
        expect(connections.patch).toHaveBeenCalledWith("ws-1", "c1", {
            meta: { email: "shop@example.test", sheets: "granted", ledgerSheet: SHEET },
        })
    })

    it("forgets the header mark of the old sheet when the sheet changes, and leaves the same sheet alone", async () => {
        const { service, connections } = await build()
        const held = withAccess({
            meta: {
                email: "shop@example.test",
                sheets: "granted",
                ledgerSheet: "old-sheet-id-0123456789",
                ledgerHeader: "written",
            },
        })
        connections.listByProvider.mockResolvedValue([held])

        await service.setLedgerSheet(actor, SHEET)
        expect(connections.patch).toHaveBeenCalledWith("ws-1", "c1", {
            meta: { email: "shop@example.test", sheets: "granted", ledgerSheet: SHEET },
        })

        connections.patch.mockClear()
        connections.listByProvider.mockResolvedValue([
            withAccess({ meta: { email: "shop@example.test", sheets: "granted", ledgerSheet: SHEET } }),
        ])
        await service.setLedgerSheet(actor, LINK)
        expect(connections.patch).not.toHaveBeenCalled()
    })

    it("refuses text that is no sheet link or id, and a workspace that gave no spreadsheets access", async () => {
        const { service, connections } = await build()

        await expect(service.setLedgerSheet(actor, "https://evil.test/x")).rejects.toEqual(
            new GoogleConnectionsError({ code: GoogleConnectionsErrorCode.SheetInvalid }),
        )
        connections.listByProvider.mockResolvedValue([record()])
        await expect(service.setLedgerSheet(actor, SHEET)).rejects.toEqual(
            new GoogleConnectionsError({ code: GoogleConnectionsErrorCode.Missing }),
        )
        expect(connections.patch).not.toHaveBeenCalled()
    })
})

describe("SheetsGrantService > setLedgerSheet, the title of the sheet", () => {
    const withAccess = () => record({ meta: { email: "shop@example.test", sheets: "granted" } })

    it("keeps the title Google gives the sheet, and still names the sheet when the title cannot be read", async () => {
        const { service, connections, google } = await build()
        connections.listByProvider.mockResolvedValue([withAccess()])
        google.spreadsheetTitle.mockResolvedValueOnce("So cai May Bakery 2026")

        await service.setLedgerSheet(actor, SHEET)
        expect(connections.patch).toHaveBeenCalledWith("ws-1", "c1", {
            meta: {
                email: "shop@example.test",
                sheets: "granted",
                ledgerSheet: SHEET,
                ledgerSheetTitle: "So cai May Bakery 2026",
            },
        })

        connections.patch.mockClear()
        google.spreadsheetTitle.mockRejectedValueOnce(new Error("refused"))
        await service.setLedgerSheet(actor, "1ZyXwVuTsRqPoNmLkJiHgFeDcBa9876543210")
        expect(connections.patch).toHaveBeenCalledWith("ws-1", "c1", {
            meta: {
                email: "shop@example.test",
                sheets: "granted",
                ledgerSheet: "1ZyXwVuTsRqPoNmLkJiHgFeDcBa9876543210",
            },
        })
    })
})

describe("SheetsGrantService > grant", () => {
    it.each([
        ["no connection", [], { state: "none", email: "", sheetId: "", sheetUrl: "", sheetTitle: "", lastRowAt: "" }],
        [
            "a connection without the access",
            [record()],
            { state: "none", email: "", sheetId: "", sheetUrl: "", sheetTitle: "", lastRowAt: "" },
        ],
        [
            "the access without a sheet",
            [record({ meta: { email: "shop@example.test", sheets: "granted" } })],
            { state: "granted", email: "shop@example.test", sheetId: "", sheetUrl: "", sheetTitle: "", lastRowAt: "" },
        ],
        [
            "the access of an account Google never named",
            [record({ meta: { sheets: "granted", ledgerSheet: SHEET } })],
            {
                state: "ready",
                email: "",
                sheetId: SHEET,
                sheetUrl: `https://docs.google.com/spreadsheets/d/${SHEET}/edit`,
                sheetTitle: "",
                lastRowAt: "",
            },
        ],
        [
            "a lost grant",
            [
                record({
                    status: "error",
                    lastError: "invalid_grant",
                    meta: { email: "shop@example.test", sheets: "granted", ledgerSheet: SHEET },
                }),
            ],
            {
                state: "lost",
                email: "shop@example.test",
                sheetId: SHEET,
                sheetUrl: `https://docs.google.com/spreadsheets/d/${SHEET}/edit`,
                sheetTitle: "",
                lastRowAt: "",
            },
        ],
    ])("reads %s", async (_name, rows, expected) => {
        const { service, connections } = await build()
        connections.listByProvider.mockResolvedValue(rows)

        await expect(service.grant(actor)).resolves.toEqual(expected)
        expect(connections.authorize).toHaveBeenCalledWith(actor, ["owner", "manager"])
    })
})

describe("SheetsGrantService > grant, the sheet it writes to", () => {
    it("tells the title of the sheet and when the last row was written", async () => {
        const { service, connections } = await build()
        connections.listByProvider.mockResolvedValue([
            record({
                meta: {
                    email: "shop@example.test",
                    sheets: "granted",
                    ledgerSheet: SHEET,
                    ledgerSheetTitle: "So cai May Bakery 2026",
                    ledgerLastRowAt: "2026-11-01T11:40:00.000Z",
                },
            }),
        ])

        await expect(service.grant(actor)).resolves.toMatchObject({
            state: "ready",
            sheetTitle: "So cai May Bakery 2026",
            lastRowAt: "2026-11-01T11:40:00.000Z",
        })
    })
})
