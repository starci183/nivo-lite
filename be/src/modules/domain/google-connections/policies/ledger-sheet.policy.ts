import type { ConnectionRecord } from "@modules/domain/connections"
import type { BusinessLedgerEntry } from "@modules/domain/provider-registry"
import { GoogleError, ledgerCategoryText, ledgerHeader, ledgerTab, ledgerVoidText } from "@modules/integrations/google"
import type { SheetCell } from "@modules/integrations/google"
import { GoogleConnectionsError, GoogleConnectionsErrorCode } from "../errors/google-connections.error"
import { CONSENT_PREFIX } from "./consent-reason.policy"

/** The spreadsheets scope among those Google granted. */
const SHEETS_SCOPE_PATTERN = /auth\/spreadsheets(\s|$)/u

/** The id inside a Google Sheets link. */
const SHEET_LINK = /^https:\/\/docs\.google\.com\/spreadsheets\/d\/([A-Za-z0-9_-]{20,100})(?:[/?#]|$)/u

/** A bare spreadsheet id. */
const SHEET_ID = /^[A-Za-z0-9_-]{20,100}$/u

/** The meta value that marks a Google connection that gave the spreadsheets access. */
export const SHEETS_GRANTED = "granted"

/** The meta value that marks a ledger sheet whose header row was written. */
export const HEADER_WRITTEN = "written"

/** The offset of Vietnam from UTC, in milliseconds: the day an entry belongs to is the day on the shop's wall. */
const VIETNAM_OFFSET_MS = 7 * 3_600_000

/** The meta value that marks a ledger sheet laid out as the cash book tab: the tab, the header and the columns of this version. */
export const LEDGER_LAYOUT = "v2"

/** The tab of the spreadsheet the ledger is written to. */
export const LEDGER_TAB: string = ledgerTab()

/** The first row of the ledger tab, written once before the first entry: date, document, description, in, out, counterpart, category, balance. */
export const LEDGER_HEADER: ReadonlyArray<SheetCell> = ledgerHeader()

/** True when Google did not say which scopes it granted, or the spreadsheets scope is among them. */
export const grantsSheets = (scope: string | null): boolean => !scope || SHEETS_SCOPE_PATTERN.test(scope)

/** The spreadsheet id a link or a bare id names; blank when the text is neither. */
export const spreadsheetIdOf = (text: string): string => {
    const trimmed = text.trim()
    return SHEET_LINK.exec(trimmed)?.[1] ?? (SHEET_ID.test(trimmed) ? trimmed : "")
}

/**
 * The running balance of a row, written as a formula that reads its own row number: the money in so far minus the money out so far. The
 * same text is right on every row, so a row written later never needs the one before it read back.
 */
export const BALANCE_FORMULA = '=SUM(D$2:INDIRECT("D"&ROW()))-SUM(E$2:INDIRECT("E"&ROW()))'

/**
 * A text cell that stays text. The sheet takes what is written as a person would type it (so the date is a date and the balance runs),
 * which would also run a formula a stranger wrote into a transfer content or turn a number with a leading zero into another number;
 * a leading apostrophe makes the cell text and is not shown.
 */
const textCell = (value: string): SheetCell => (value === "" ? "" : `'${value}`)

/**
 * The row of a ledger entry, in the order of the header: date, document (the order number, else the bank reference), description,
 * money in, money out, counterpart, category and the running balance. A void entry puts the amount on the other side, so it takes the
 * original back and the balance follows.
 */
export const ledgerRowOf = (entry: BusinessLedgerEntry): ReadonlyArray<SheetCell> => {
    const takenBack = entry.status === "void"
    const out = ((entry.direction ?? "in") === "out") !== takenBack
    const words = [takenBack ? ledgerVoidText() : "", entry.description ?? "", entry.note].filter((part) => part !== "")
    return [
        entry.date,
        textCell(entry.documentNo ?? entry.orderNo),
        textCell(words.join(" · ")),
        out ? "" : entry.amountVnd,
        out ? entry.amountVnd : "",
        textCell(entry.counterpart ?? entry.customer),
        textCell(ledgerCategoryText(entry.category ?? "sale")),
        BALANCE_FORMULA,
    ]
}

/** The day (`YYYY-MM-DD`) an instant belongs to on the shop's wall. */
export const dayOf = (now: Date): string => new Date(now.getTime() + VIETNAM_OFFSET_MS).toISOString().slice(0, 10)

/** The row that takes one transaction back by its key alone: the day, the key and the word for a reversal, with no amount. */
export const voidRowOf = (transactionId: string, day: string): ReadonlyArray<SheetCell> => [
    day,
    textCell(transactionId),
    textCell(ledgerVoidText()),
    "",
    "",
    "",
    "",
    BALANCE_FORMULA,
]

/** True when the connection gave the spreadsheets access and is still in use. */
const isLedgerGrant = (row: ConnectionRecord): boolean =>
    row.meta.sheets === SHEETS_GRANTED && row.status !== "disconnected" && row.status !== "pending"

/** The connection that keeps the ledger and the sheet it was told: one that gave the spreadsheets access and was told a sheet; oldest first. */
export const ledgerKeeperOf = (
    rows: ReadonlyArray<ConnectionRecord>,
): { readonly row: ConnectionRecord; readonly sheetId: string } | undefined => {
    for (const row of rows) {
        const sheetId = row.meta.ledgerSheet ?? ""
        if (sheetId !== "" && isLedgerGrant(row)) return { row, sheetId }
    }
    return undefined
}

/** The connection that keeps the ledger: one that gave the spreadsheets access and was told a sheet; oldest first. */
export const ledgerConnectionOf = (rows: ReadonlyArray<ConnectionRecord>): ConnectionRecord | undefined =>
    ledgerKeeperOf(rows)?.row

/** The connection to tell the ledger sheet: the one that already keeps it, else the oldest that gave the access and works. */
export const grantRowOf = (rows: ReadonlyArray<ConnectionRecord>): ConnectionRecord | undefined =>
    ledgerConnectionOf(rows) ?? rows.find((row) => isLedgerGrant(row) && row.status === "connected")

/**
 * The connection a consent updates: the same Google account (same email) re-consenting updates its connection, a row left by a refused
 * consent is reused for the first account, and so is the row the seed made while it waits for the owner's first consent.
 */
export const consentRowOf = (rows: ReadonlyArray<ConnectionRecord>, email: string | null): ConnectionRecord | null => {
    const sameAccount = email === null ? undefined : rows.find((row) => row.meta.email === email)
    if (sameAccount) return sameAccount
    const awaiting = (row: ConnectionRecord): boolean =>
        (row.status === "error" && (row.lastError ?? "").startsWith(CONSENT_PREFIX)) ||
        (row.status === "pending" && row.meta.consent === "needed")
    return rows.find(awaiting) ?? null
}

/** The public facts a consent leaves on a connection: the account email, and `consent: given` where the seed had made it wait. */
export const consentedMeta = (
    meta: Readonly<Record<string, string>> | undefined,
    email: string,
): Readonly<Record<string, string>> => {
    const { consent, ...kept } = meta ?? {}
    return consent === undefined ? { ...kept, email } : { ...kept, email, consent: "given" }
}

/**
 * True when Google or the stored grant refused the connection itself, which only the owner can cure: the spreadsheet is not shared with the
 * account or does not exist (404, 403, 400), the token or the scope was withdrawn (401, 403), or the grant is gone. A timeout, a 429 or a
 * 5xx is not one: the run tries again.
 */
export const isRefusedLedger = (error: unknown): boolean => {
    if (error instanceof GoogleError) return [400, 401, 403, 404].includes(Number(error.params.status))
    if (!(error instanceof GoogleConnectionsError)) return false
    return [
        GoogleConnectionsErrorCode.Lost,
        GoogleConnectionsErrorCode.Missing,
        GoogleConnectionsErrorCode.NotConfigured,
    ].includes(error.code)
}
