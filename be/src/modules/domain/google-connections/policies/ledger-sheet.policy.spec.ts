import { Test } from "@nestjs/testing"
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

/** The members of the subject under test. */
interface Subject {
    readonly consentedMeta: typeof consentedMeta
    readonly consentRowOf: typeof consentRowOf
    readonly dayOf: typeof dayOf
    readonly grantRowOf: typeof grantRowOf
    readonly grantsSheets: typeof grantsSheets
    readonly isRefusedLedger: typeof isRefusedLedger
    readonly ledgerConnectionOf: typeof ledgerConnectionOf
    readonly ledgerRowOf: typeof ledgerRowOf
    readonly spreadsheetIdOf: typeof spreadsheetIdOf
    readonly voidRowOf: typeof voidRowOf
}

const SUBJECT = Symbol("ledger-sheet.policy")

/** The policy functions, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    consentedMeta,
                    consentRowOf,
                    dayOf,
                    grantRowOf,
                    grantsSheets,
                    isRefusedLedger,
                    ledgerConnectionOf,
                    ledgerRowOf,
                    spreadsheetIdOf,
                    voidRowOf,
                },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

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
    ])("reads the scope %j as %s", async (scope, expected) => {
        const subject = await build()

        expect(subject.grantsSheets(scope)).toBe(expected)
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
    ])("reads %j as %j", async (text, id) => {
        const subject = await build()

        expect(subject.spreadsheetIdOf(text)).toBe(id)
    })
})

describe("the rows of the ledger", () => {
    it("lays an entry out in the order of the header", async () => {
        const subject = await build()

        expect(LEDGER_HEADER).toHaveLength(7)
        expect(
            subject.ledgerRowOf({
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

    it("marks a void entry VOID", async () => {
        const subject = await build()

        expect(
            subject.ledgerRowOf({
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

    it("takes a transaction back with its key and the status only", async () => {
        const subject = await build()

        expect(subject.voidRowOf("sepay:1", "2026-11-04")).toEqual([
            "2026-11-04",
            "",
            "",
            "",
            "sepay:1",
            "VOID",
            "Hoan tac",
        ])
    })

    it("dates an instant by the wall of Vietnam", async () => {
        const subject = await build()

        expect(subject.dayOf(new Date("2026-11-03T18:30:00.000Z"))).toBe("2026-11-04")
        expect(subject.dayOf(new Date("2026-11-03T16:30:00.000Z"))).toBe("2026-11-03")
    })
})

describe("ledgerConnectionOf and grantRowOf", () => {
    it("keeps the ledger on the oldest connection that gave the access and was told a sheet", async () => {
        const subject = await build()

        const noSheet = record({ id: "a", meta: { sheets: "granted" } })
        const keeper = granted({ id: "b" })

        expect(subject.ledgerConnectionOf([record({ id: "plain" }), noSheet, keeper, granted({ id: "c" })])?.id).toBe(
            "b",
        )
    })

    it.each([
        ["disconnected", { status: "disconnected" as const }],
        ["pending", { status: "pending" as const }],
    ])("never keeps it on a %s connection", async (_name, overrides) => {
        const subject = await build()

        expect(subject.ledgerConnectionOf([granted(overrides)])).toBeUndefined()
    })

    it("still keeps it on a connection whose grant was lost, so the owner is told", async () => {
        const subject = await build()

        expect(subject.ledgerConnectionOf([granted({ status: "error", lastError: "invalid_grant" })])?.id).toBe("c1")
    })

    it("names the connection to tell the sheet: the one that keeps it, else the oldest working one with the access", async () => {
        const subject = await build()

        const waiting = record({ id: "w", meta: { sheets: "granted" } })
        const lost = record({ id: "l", status: "error", meta: { sheets: "granted" } })

        expect(subject.grantRowOf([waiting, granted({ id: "k" })])?.id).toBe("k")
        expect(subject.grantRowOf([lost, waiting])?.id).toBe("w")
        expect(subject.grantRowOf([record()])).toBeUndefined()
    })
})

describe("consentRowOf and consentedMeta", () => {
    it("reuses the row of the same account, a refused-consent row and the row the seed made, in that order", async () => {
        const subject = await build()

        const seeded = record({ id: "seeded", status: "pending", meta: { consent: "needed" } })
        const refused = record({ id: "refused", status: "error", lastError: "consent:access_denied", meta: {} })
        const same = record({ id: "same", meta: { email: "a@example.test" } })

        expect(subject.consentRowOf([seeded, refused, same], "a@example.test")?.id).toBe("same")
        expect(subject.consentRowOf([seeded, refused], "a@example.test")?.id).toBe("seeded")
        expect(subject.consentRowOf([refused], "a@example.test")?.id).toBe("refused")
        expect(subject.consentRowOf([record({ id: "p", status: "pending", meta: {} })], null)).toBeNull()
    })

    it("marks the seeded wait given, and adds nothing to a connection that never waited", async () => {
        const subject = await build()

        expect(subject.consentedMeta({ oauth_client_id: "c", consent: "needed" }, "a@example.test")).toEqual({
            oauth_client_id: "c",
            email: "a@example.test",
            consent: "given",
        })
        expect(subject.consentedMeta({ sheets: "granted" }, "a@example.test")).toEqual({
            sheets: "granted",
            email: "a@example.test",
        })
        expect(subject.consentedMeta(undefined, "")).toEqual({ email: "" })
    })
})

describe("isRefusedLedger", () => {
    it.each([400, 401, 403, 404])("treats a Google %s as the owner's to cure", async (status) => {
        const subject = await build()

        expect(subject.isRefusedLedger(googleRefusal({ status }))).toBe(true)
    })

    it.each([429, 500, 503])("treats a Google %s as a failure to try again", async (status) => {
        const subject = await build()

        expect(subject.isRefusedLedger(googleRefusal({ status }))).toBe(false)
    })

    it("treats a Google refusal that names no status as a failure to try again", async () => {
        const subject = await build()

        expect(subject.isRefusedLedger(googleRefusal())).toBe(false)
    })

    it("treats a lost, missing or unconfigured grant as the owner's to cure, and anything else as not", async () => {
        const subject = await build()

        for (const code of [
            GoogleConnectionsErrorCode.Lost,
            GoogleConnectionsErrorCode.Missing,
            GoogleConnectionsErrorCode.NotConfigured,
        ]) {
            expect(subject.isRefusedLedger(new GoogleConnectionsError({ code }))).toBe(true)
        }
        expect(
            subject.isRefusedLedger(new GoogleConnectionsError({ code: GoogleConnectionsErrorCode.SheetInvalid })),
        ).toBe(false)
        expect(subject.isRefusedLedger(new Error("timeout"))).toBe(false)
    })
})
