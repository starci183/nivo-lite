import { FakeClock, mock } from "@starci/jest-preset"
import { ConnectionsService } from "@modules/domain/connections"
import { LedgerConnectionRefusedError } from "@modules/domain/provider-registry"
import type { LedgerEntry } from "@modules/domain/provider-registry"
import type { GoogleClient } from "@modules/integrations/google"
import { GoogleConnectionsError, GoogleConnectionsErrorCode } from "./errors/google-connections.error"
import { GoogleLedgerService } from "./google-ledger.service"
import { GoogleTokensService } from "./google-tokens.service"
import { LEDGER_HEADER } from "./policies/ledger-sheet.policy"
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
const ENTRY: LedgerEntry = {
    date: "2026-11-04",
    orderNo: "DH-7",
    customer: "Dinh",
    amountVnd: 5000,
    transactionId: "sepay:95958515",
    status: "paid",
    note: "",
}
const ROW = ["2026-11-04", "DH-7", "Dinh", 5000, "sepay:95958515", "PAID", ""]
const ledgerRow = (meta = {}, overrides = {}) =>
    record({ meta: { email: "shop@example.test", sheets: "granted", ledgerSheet: SHEET, ...meta }, ...overrides })
const FRESH = { ...stored, access_token: "access-fresh", expires_at: EXPIRES }

const build = (rows = [ledgerRow()]) => {
    const connections = mock<ConnectionsService>()
    connections.listByProvider.mockResolvedValue(rows)
    connections.readSecret.mockResolvedValue({ plain: JSON.stringify(FRESH), webhookSecret: "hook-1" })
    const google = mock<GoogleClient>()
    google.isConfigured.mockReturnValue(true)
    google.appendValues.mockResolvedValue("Sheet1!A2:G3")
    google.refreshAccessToken.mockResolvedValue(tokens)
    const store = mock<GoogleTokensService>()
    const clock = new FakeClock(NOW)
    runRealGoogleTokens(store, connections, google, clock)
    return { service: new GoogleLedgerService(connections, google, store, clock), connections, google }
}

describe("GoogleLedgerService > ready", () => {
    it("is ready when a Google connection gave the spreadsheets access and was told the sheet", async () => {
        await expect(build().service.ready("ws-1")).resolves.toBe(true)
    })

    it.each([
        ["no Google connection", []],
        ["a connection without the access", [record()]],
        ["the access without a sheet", [ledgerRow({ ledgerSheet: "" })]],
        ["a connection that waits for the first consent", [record({ status: "pending", meta: { consent: "needed" } })]],
    ])("is not ready with %s, so the ledger step is skipped", async (_name, rows) => {
        const { service, google } = build(rows)

        await expect(service.ready("ws-1")).resolves.toBe(false)
        await expect(service.append("ws-1", ENTRY)).resolves.toBeUndefined()
        await expect(service.void("ws-1", ENTRY.transactionId)).resolves.toBeUndefined()
        expect(google.appendValues).not.toHaveBeenCalled()
    })
})

describe("GoogleLedgerService > append", () => {
    it("writes the header with the first entry, once, and marks the sheet headed", async () => {
        const { service, google, connections } = build()

        await expect(service.append("ws-1", ENTRY)).resolves.toBe("Sheet1!A2:G3")

        expect(google.appendValues).toHaveBeenCalledWith("access-fresh", SHEET, [LEDGER_HEADER, ROW])
        expect(connections.patch).toHaveBeenCalledWith("ws-1", "c1", {
            meta: { email: "shop@example.test", sheets: "granted", ledgerSheet: SHEET, ledgerHeader: "written" },
        })
    })

    it("writes only the row once the header is there, and changes no cell", async () => {
        const { service, google, connections } = build([ledgerRow({ ledgerHeader: "written" })])

        await service.append("ws-1", ENTRY)

        expect(google.appendValues).toHaveBeenCalledWith("access-fresh", SHEET, [ROW])
        expect(connections.patch).not.toHaveBeenCalled()
        expect(google.readValues).not.toHaveBeenCalled()
    })

    it("answers the sheet itself when Google names no range", async () => {
        const { service, google } = build([ledgerRow({ ledgerHeader: "written" })])
        google.appendValues.mockResolvedValue("")

        await expect(service.append("ws-1", ENTRY)).resolves.toBe(SHEET)
    })

    it("refreshes the token once and writes again when Google refuses the one it holds with 401", async () => {
        const { service, google } = build([ledgerRow({ ledgerHeader: "written" })])
        google.appendValues.mockRejectedValueOnce(googleRefusal({ status: 401 })).mockResolvedValueOnce("Sheet1!A4:G4")

        await expect(service.append("ws-1", ENTRY)).resolves.toBe("Sheet1!A4:G4")
        expect(google.refreshAccessToken).toHaveBeenCalledTimes(1)
        expect(google.appendValues).toHaveBeenLastCalledWith("access-new", SHEET, [ROW])
    })

    it.each([
        ["a sheet not shared with the account", googleRefusal({ status: 403 })],
        ["a sheet that is gone", googleRefusal({ status: 404 })],
        ["a token still refused after the refresh", googleRefusal({ status: 401 })],
        ["a revoked grant", new GoogleConnectionsError({ code: GoogleConnectionsErrorCode.Lost })],
    ])("throws the refused connection for %s, which only the owner cures", async (_name, failure) => {
        const { service, google } = build([ledgerRow({ ledgerHeader: "written" })])
        google.appendValues.mockRejectedValue(failure)

        await expect(service.append("ws-1", ENTRY)).rejects.toEqual(new LedgerConnectionRefusedError("google"))
    })

    it.each([
        ["a rate limit", googleRefusal({ status: 429 })],
        ["a server error", googleRefusal({ status: 503 })],
        ["a timeout", new Error("timeout")],
    ])("throws %s as it is, so the run tries again", async (_name, failure) => {
        const { service, google } = build([ledgerRow({ ledgerHeader: "written" })])
        google.appendValues.mockRejectedValue(failure)

        await expect(service.append("ws-1", ENTRY)).rejects.toBe(failure)
    })

    it("is refused when Google is not set up on the deployment", async () => {
        const { service, google } = build()
        google.isConfigured.mockReturnValue(false)

        await expect(service.append("ws-1", ENTRY)).rejects.toEqual(new LedgerConnectionRefusedError("google"))
        expect(google.appendValues).not.toHaveBeenCalled()
    })
})

describe("GoogleLedgerService > void", () => {
    it("adds one row that names the transaction and the day, and removes nothing", async () => {
        const { service, google } = build([ledgerRow({ ledgerHeader: "written" })])

        await service.void("ws-1", ENTRY.transactionId)

        expect(google.appendValues).toHaveBeenCalledWith("access-fresh", SHEET, [
            ["2026-10-12", "", "", "", "sepay:95958515", "VOID", "Hoan tac"],
        ])
    })
})
