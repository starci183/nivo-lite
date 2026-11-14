import { FakeClock, mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { WorkspaceTimeZoneService } from "@modules/domain/workspace-settings"
import { ConnectionsService } from "@modules/domain/connections"
import { ProviderRegistryErrorCode, proofOf } from "@modules/domain/provider-registry"
import type { BusinessLedgerEntry } from "@modules/domain/provider-registry"
import { GOOGLE_CLIENT, ledgerCategoryText, ledgerVoidText } from "@modules/integrations/google"
import type { GoogleClient } from "@modules/integrations/google"
import { CLOCK } from "@modules/platform/clock"
import { GoogleConnectionsError, GoogleConnectionsErrorCode } from "./errors/google-connections.error"
import { GoogleLedgerService } from "./google-ledger.service"
import { GoogleTokensService } from "./google-tokens.service"
import { BALANCE_FORMULA, LEDGER_HEADER, LEDGER_TAB } from "./policies/ledger-sheet.policy"
import { runRealGoogleTokens } from "@tests/fixtures/builders/google-tokens.builder"
import {
    EXPIRES,
    googleRefusal,
    NOW,
    record,
    stored,
    tokens,
} from "@tests/fixtures/builders/google-connections.builder"

const SHEET = "1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789"
const ENTRY: BusinessLedgerEntry = {
    date: "2026-11-04",
    orderNo: "DH-7",
    customer: "Dinh",
    amountVnd: 5000,
    transactionId: "sepay:95958515",
    status: "paid",
    note: "",
}
const ROW = ["2026-11-04", "'DH-7", "", 5000, "", "'Dinh", `'${ledgerCategoryText("sale")}`, BALANCE_FORMULA]
const HEADED = { ledgerHeader: "written", ledgerLayout: "v2" }
const ledgerRow = (meta = {}, overrides = {}) =>
    record({ meta: { email: "shop@example.test", sheets: "granted", ledgerSheet: SHEET, ...meta }, ...overrides })
const FRESH = { ...stored, access_token: "access-fresh", expires_at: EXPIRES }

const build = async (rows = [ledgerRow()]) => {
    const connections = mock<ConnectionsService>()
    connections.listByProvider.mockResolvedValue(rows)
    connections.readSecret.mockResolvedValue({ plain: JSON.stringify(FRESH), webhookSecret: "hook-1" })
    const google = mock<GoogleClient>()
    google.isConfigured.mockReturnValue(true)
    google.appendValues.mockResolvedValue("Sheet1!A2:G3")
    google.ensureTab.mockResolvedValue(undefined)
    google.refreshAccessToken.mockResolvedValue(tokens)
    const store = mock<GoogleTokensService>()
    const clock = new FakeClock(NOW)
    runRealGoogleTokens(store, connections, google, clock)
    const zones = mock<WorkspaceTimeZoneService>({ timeZoneOf: jest.fn().mockResolvedValue("Asia/Ho_Chi_Minh") })
    const moduleRef = await Test.createTestingModule({
        providers: [
            GoogleLedgerService,
            { provide: ConnectionsService, useValue: connections },
            { provide: GOOGLE_CLIENT, useValue: google },
            { provide: GoogleTokensService, useValue: store },
            { provide: CLOCK, useValue: clock },
            { provide: WorkspaceTimeZoneService, useValue: zones },
        ],
    }).compile()
    return { service: moduleRef.get(GoogleLedgerService), connections, google, zones }
}

describe("GoogleLedgerService > ready", () => {
    it("is ready when a Google connection gave the spreadsheets access and was told the sheet", async () => {
        await expect((await build()).service.ready("ws-1")).resolves.toBe(true)
    })

    it.each([
        ["no Google connection", []],
        ["a connection without the access", [record()]],
        ["the access without a sheet", [ledgerRow({ ledgerSheet: "" })]],
        ["a connection that waits for the first consent", [record({ status: "pending", meta: { consent: "needed" } })]],
    ])("is not ready with %s, so the ledger step is skipped", async (_name, rows) => {
        const { service, google } = await build(rows)

        await expect(service.ready("ws-1")).resolves.toBe(false)
        await expect(service.append("ws-1", ENTRY)).resolves.toBeUndefined()
        await expect(service.void("ws-1", ENTRY.transactionId)).resolves.toBeUndefined()
        expect(google.appendValues).not.toHaveBeenCalled()
    })
})

describe("GoogleLedgerService > append, once the header is there", () => {
    it("writes only the row once the header is there, and changes no cell", async () => {
        const { service, google, connections } = await build([ledgerRow(HEADED)])

        await service.append("ws-1", ENTRY)

        expect(google.appendValues).toHaveBeenCalledWith("access-fresh", SHEET, LEDGER_TAB, [ROW])
        expect(connections.patch).toHaveBeenCalledWith("ws-1", "c1", {
            meta: {
                email: "shop@example.test",
                sheets: "granted",
                ledgerSheet: SHEET,
                ledgerHeader: "written",
                ledgerLayout: "v2",
                ledgerLastRowAt: new Date(NOW).toISOString(),
            },
        })
        expect(google.readValues).not.toHaveBeenCalled()
    })
})

describe("GoogleLedgerService > append", () => {
    it("writes the header with the first entry, once, and marks the sheet headed", async () => {
        const { service, google, connections } = await build()

        await expect(service.append("ws-1", ENTRY)).resolves.toBe("Sheet1!A2:G3")

        expect(google.appendValues).toHaveBeenCalledWith("access-fresh", SHEET, LEDGER_TAB, [LEDGER_HEADER, ROW])
        expect(connections.patch).toHaveBeenCalledWith("ws-1", "c1", {
            meta: {
                email: "shop@example.test",
                sheets: "granted",
                ledgerSheet: SHEET,
                ledgerHeader: "written",
                ledgerLayout: "v2",
                ledgerLastRowAt: new Date(NOW).toISOString(),
            },
        })
    })

    it("adds the cash book tab before the header and the first entry", async () => {
        const { service, google } = await build()

        await service.append("ws-1", ENTRY)

        expect(google.ensureTab).toHaveBeenCalledWith("access-fresh", SHEET, LEDGER_TAB)
    })

    it("lays out again a sheet an older version headed: the new tab and header once, then rows only", async () => {
        const { service, google, connections } = await build([ledgerRow({ ledgerHeader: "written" })])

        await service.append("ws-1", ENTRY)

        expect(google.ensureTab).toHaveBeenCalledTimes(1)
        expect(google.appendValues).toHaveBeenCalledWith("access-fresh", SHEET, LEDGER_TAB, [LEDGER_HEADER, ROW])
        const written: unknown = expect.objectContaining({ ledgerHeader: "written", ledgerLayout: "v2" })
        expect(connections.patch).toHaveBeenCalledWith("ws-1", "c1", expect.objectContaining({ meta: written }))
    })

    it("does not look for the tab again once the sheet is laid out", async () => {
        const { service, google } = await build([ledgerRow(HEADED)])

        await service.append("ws-1", ENTRY)

        expect(google.ensureTab).not.toHaveBeenCalled()
    })

    it("answers the sheet itself when Google names no range", async () => {
        const { service, google } = await build([ledgerRow(HEADED)])
        google.appendValues.mockResolvedValue("")

        await expect(service.append("ws-1", ENTRY)).resolves.toBe(SHEET)
    })

})

describe("GoogleLedgerService > append, refused tokens and failures", () => {
    it("refreshes the token once and writes again when Google refuses the one it holds with 401", async () => {
        const { service, google } = await build([ledgerRow(HEADED)])
        google.appendValues.mockRejectedValueOnce(googleRefusal({ status: 401 })).mockResolvedValueOnce("Sheet1!A4:G4")

        await expect(service.append("ws-1", ENTRY)).resolves.toBe("Sheet1!A4:G4")
        expect(google.refreshAccessToken).toHaveBeenCalledTimes(1)
        expect(google.appendValues).toHaveBeenLastCalledWith("access-new", SHEET, LEDGER_TAB, [ROW])
    })

    it.each([
        ["a sheet not shared with the account", googleRefusal({ status: 403 })],
        ["a sheet that is gone", googleRefusal({ status: 404 })],
        ["a token still refused after the refresh", googleRefusal({ status: 401 })],
        ["a revoked grant", new GoogleConnectionsError({ code: GoogleConnectionsErrorCode.Lost })],
    ])("throws the refused connection for %s, which only the owner cures", async (_name, failure) => {
        const { service, google } = await build([ledgerRow(HEADED)])
        google.appendValues.mockRejectedValue(failure)

        await expect(service.append("ws-1", ENTRY)).rejects.toMatchObject({
            code: ProviderRegistryErrorCode.LedgerConnectionRefused,
            params: { provider: "google" },
        })
    })

    it.each([
        ["a rate limit", googleRefusal({ status: 429 })],
        ["a server error", googleRefusal({ status: 503 })],
        ["a timeout", new Error("timeout")],
    ])("throws %s as it is, so the run tries again", async (_name, failure) => {
        const { service, google } = await build([ledgerRow(HEADED)])
        google.appendValues.mockRejectedValue(failure)

        await expect(service.append("ws-1", ENTRY)).rejects.toBe(failure)
    })

    it("says what a failure proves where it happened: before the append the row never left, after it the row may be there", async () => {
        const before = await build([ledgerRow()])
        const tab = new Error("tab")
        before.google.ensureTab.mockRejectedValue(tab)
        await expect(before.service.append("ws-1", ENTRY)).rejects.toBe(tab)
        expect(proofOf(tab)).toBe("not_sent")

        const after = await build([ledgerRow(HEADED)])
        const lost = new Error("lost")
        after.google.appendValues.mockRejectedValue(lost)
        await expect(after.service.append("ws-1", ENTRY)).rejects.toBe(lost)
        expect(proofOf(lost)).toBe("unknown")
    })

    it("writes on the connection the tool runner handed the call, and on no other", async () => {
        const { service, google } = await build([ledgerRow(HEADED)])

        await expect(service.append("ws-1", ENTRY, "another-connection")).resolves.toBeUndefined()
        expect(google.appendValues).not.toHaveBeenCalled()
    })

    it("is refused when Google is not set up on the deployment", async () => {
        const { service, google } = await build()
        google.isConfigured.mockReturnValue(false)

        await expect(service.append("ws-1", ENTRY)).rejects.toMatchObject({
            code: ProviderRegistryErrorCode.LedgerConnectionRefused,
            params: { provider: "google" },
        })
        expect(google.appendValues).not.toHaveBeenCalled()
    })
})

describe("GoogleLedgerService > void", () => {
    it("adds one row that names the transaction and the day, and removes nothing", async () => {
        const { service, google } = await build([ledgerRow(HEADED)])

        await service.void("ws-1", ENTRY.transactionId)

        expect(google.appendValues).toHaveBeenCalledWith("access-fresh", SHEET, LEDGER_TAB, [
            ["2026-10-12", "'sepay:95958515", `'${ledgerVoidText()}`, "", "", "", "", BALANCE_FORMULA],
        ])
    })

    it("dates the row on the wall clock of the zone the workspace saved", async () => {
        const { service, google, zones } = await build([ledgerRow(HEADED)])
        zones.timeZoneOf.mockResolvedValue("Pacific/Pago_Pago")

        await service.void("ws-1", ENTRY.transactionId)

        expect(zones.timeZoneOf).toHaveBeenCalledWith("ws-1")
        expect(google.appendValues.mock.calls[0]?.[3]?.[0]?.[0]).toBe("2026-10-11")
    })
})
