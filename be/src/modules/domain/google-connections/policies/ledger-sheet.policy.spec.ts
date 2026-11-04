import { GoogleConnectionsError, GoogleConnectionsErrorCode } from "../errors/google-connections.error"
import { googleRefusal, record } from "@tests/fixtures/builders/google-connections.builder"
import {
    consentedMeta,
    consentRowOf,
    dayOf,
    grantRowOf,
    grantsSheets,
    isRefusedLedger,
    LEDGER_HEADER,
    ledgerConnectionOf,
    ledgerRowOf,
    spreadsheetIdOf,
    voidRowOf,
} from "./ledger-sheet.policy"

const SHEET = "1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789"
const granted = (overrides = {}) =>
    record({ meta: { email: "shop@example.test", sheets: "granted", ledgerSheet: SHEET }, ...overrides })

describe("grantsSheets", () => {
    it.each([
        [null, true],
        ["openid email https://www.googleapis.com/auth/spreadsheets", true],
        ["https://www.googleapis.com/auth/spreadsheets openid", true],
        ["openid email https://www.googleapis.com/auth/drive.file", false],
        ["https://www.googleapis.com/auth/spreadsheets.readonly", false],
    ])("reads the scope %j as %s", (scope, expected) => {
        expect(grantsSheets(scope)).toBe(expected)
    })
})

describe("spreadsheetIdOf", () => {
    it.each([
        [`https://docs.google.com/spreadsheets/d/${SHEET}/edit#gid=0`, SHEET],
        [`  https://docs.google.com/spreadsheets/d/${SHEET}  `, SHEET],
        [SHEET, SHEET],
        ["https://evil.test/spreadsheets/d/" + SHEET, ""],
        ["short", ""],
        ["not a sheet id with spaces in it at all", ""],
    ])("reads %j as %j", (text, id) => {
        expect(spreadsheetIdOf(text)).toBe(id)
    })
})

describe("the rows of the ledger", () => {
    it("lays an entry out in the order of the header", () => {
        expect(LEDGER_HEADER).toHaveLength(7)
        expect(
            ledgerRowOf({
                date: "2026-11-04",
                orderNo: "DH-7",
                customer: "=HYPERLINK(x)",
                amountVnd: 5000,
                transactionId: "sepay:1",
                status: "paid",
                note: "ghi chu",
            }),
        ).toEqual(["2026-11-04", "DH-7", "=HYPERLINK(x)", 5000, "sepay:1", "PAID", "ghi chu"])
    })

    it("marks a void entry VOID", () => {
        expect(
            ledgerRowOf({
                date: "2026-11-04",
                orderNo: "",
                customer: "",
                amountVnd: 0,
                transactionId: "t",
                status: "void",
                note: "",
            })[5],
        ).toBe("VOID")
    })

    it("takes a transaction back with its key and the status only", () => {
        expect(voidRowOf("sepay:1", "2026-11-04")).toEqual(["2026-11-04", "", "", "", "sepay:1", "VOID", "Hoan tac"])
    })

    it("dates an instant by the wall of Vietnam", () => {
        expect(dayOf(new Date("2026-11-03T18:30:00.000Z"))).toBe("2026-11-04")
        expect(dayOf(new Date("2026-11-03T16:30:00.000Z"))).toBe("2026-11-03")
    })
})

describe("ledgerConnectionOf and grantRowOf", () => {
    it("keeps the ledger on the oldest connection that gave the access and was told a sheet", () => {
        const noSheet = record({ id: "a", meta: { sheets: "granted" } })
        const keeper = granted({ id: "b" })

        expect(ledgerConnectionOf([record({ id: "plain" }), noSheet, keeper, granted({ id: "c" })])?.id).toBe("b")
    })

    it.each([
        ["disconnected", { status: "disconnected" as const }],
        ["pending", { status: "pending" as const }],
    ])("never keeps it on a %s connection", (_name, overrides) => {
        expect(ledgerConnectionOf([granted(overrides)])).toBeUndefined()
    })

    it("still keeps it on a connection whose grant was lost, so the owner is told", () => {
        expect(ledgerConnectionOf([granted({ status: "error", lastError: "invalid_grant" })])?.id).toBe("c1")
    })

    it("names the connection to tell the sheet: the one that keeps it, else the oldest working one with the access", () => {
        const waiting = record({ id: "w", meta: { sheets: "granted" } })
        const lost = record({ id: "l", status: "error", meta: { sheets: "granted" } })

        expect(grantRowOf([waiting, granted({ id: "k" })])?.id).toBe("k")
        expect(grantRowOf([lost, waiting])?.id).toBe("w")
        expect(grantRowOf([record()])).toBeUndefined()
    })
})

describe("consentRowOf and consentedMeta", () => {
    it("reuses the row of the same account, a refused-consent row and the row the seed made, in that order", () => {
        const seeded = record({ id: "seeded", status: "pending", meta: { consent: "needed" } })
        const refused = record({ id: "refused", status: "error", lastError: "consent:access_denied", meta: {} })
        const same = record({ id: "same", meta: { email: "a@example.test" } })

        expect(consentRowOf([seeded, refused, same], "a@example.test")?.id).toBe("same")
        expect(consentRowOf([seeded, refused], "a@example.test")?.id).toBe("seeded")
        expect(consentRowOf([refused], "a@example.test")?.id).toBe("refused")
        expect(consentRowOf([record({ id: "p", status: "pending", meta: {} })], null)).toBeNull()
    })

    it("marks the seeded wait given, and adds nothing to a connection that never waited", () => {
        expect(consentedMeta({ oauth_client_id: "c", consent: "needed" }, "a@example.test")).toEqual({
            oauth_client_id: "c",
            email: "a@example.test",
            consent: "given",
        })
        expect(consentedMeta({ sheets: "granted" }, "a@example.test")).toEqual({
            sheets: "granted",
            email: "a@example.test",
        })
        expect(consentedMeta(undefined, "")).toEqual({ email: "" })
    })
})

describe("isRefusedLedger", () => {
    it.each([400, 401, 403, 404])("treats a Google %s as the owner's to cure", (status) => {
        expect(isRefusedLedger(googleRefusal({ status }))).toBe(true)
    })

    it.each([429, 500, 503])("treats a Google %s as a failure to try again", (status) => {
        expect(isRefusedLedger(googleRefusal({ status }))).toBe(false)
    })

    it("treats a Google refusal that names no status as a failure to try again", () => {
        expect(isRefusedLedger(googleRefusal())).toBe(false)
    })

    it("treats a lost, missing or unconfigured grant as the owner's to cure, and anything else as not", () => {
        for (const code of [
            GoogleConnectionsErrorCode.Lost,
            GoogleConnectionsErrorCode.Missing,
            GoogleConnectionsErrorCode.NotConfigured,
        ]) {
            expect(isRefusedLedger(new GoogleConnectionsError({ code }))).toBe(true)
        }
        expect(isRefusedLedger(new GoogleConnectionsError({ code: GoogleConnectionsErrorCode.SheetInvalid }))).toBe(
            false,
        )
        expect(isRefusedLedger(new Error("timeout"))).toBe(false)
    })
})
