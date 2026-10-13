import type { useFormatter, useTranslations } from "next-intl"
import type {
    AccountingInvoiceStatus,
    AccountingLedgerStatus,
    AccountingLineageStep,
    AccountingMatchState,
    AccountingOrigin,
    AccountingSourceKind,
} from "@/modules/types"

/** The reader's number and date formatter (next-intl, product time zone). */
export type AccountingFormat = ReturnType<typeof useFormatter>

/** The translator of the Accounting catalog namespace. */
export type AccountingTranslator = ReturnType<typeof useTranslations>

/** Badge tones the grammar offers for a status. */
export type AccountingTone = "success" | "warning" | "neutral" | "accent"

const VIETNAM_OFFSET_MS = 7 * 3_600_000
const HOUR_MS = 3_600_000

/** "1.250.000" with the currency the reader's language uses, or a dash when there is no amount. */
export const moneyOf = (format: AccountingFormat, amount: number | null | undefined): string =>
    amount === null || amount === undefined
        ? "-"
        : format.number(amount, { style: "currency", currency: "VND", maximumFractionDigits: 0 })

/** Day and month (and year) in Vietnam time. */
export const dayOf = (format: AccountingFormat, iso: string | null | undefined, withYear = true): string =>
    iso === null || iso === undefined
        ? "-"
        : format.dateTime(new Date(iso), { day: "2-digit", month: "2-digit", ...(withYear ? { year: "numeric" } : {}) })

/** Day, month and clock time in Vietnam time. */
export const accountingStampOf = (format: AccountingFormat, iso: string | null | undefined): string =>
    iso === null || iso === undefined
        ? "-"
        : format.dateTime(new Date(iso), {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
          })

/** The month a period covers, e.g. "10/2026". The extra hour keeps the instant inside the month it opens. */
export const monthOf = (format: AccountingFormat, iso: string): string =>
    format.dateTime(new Date(new Date(iso).getTime() + HOUR_MS), { month: "2-digit", year: "numeric" })

/** Today as yyyy-mm-dd in Vietnam time (default of the date field). */
export const vietnamToday = (): string => new Date(Date.now() + VIETNAM_OFFSET_MS).toISOString().slice(0, 10)

/** Digits only to a number, or null. */
export const digitsToNumber = (raw: string): number | null => {
    const only = raw.replace(/\D/gu, "")
    return only === "" ? null : Number(only)
}

/** The word for where a record came from. */
export const originLabelOf = (t: AccountingTranslator, origin: AccountingOrigin): string =>
    origin === "simulated" ? t("originSimulated") : t("originLive")

const SOURCE_KEYS: Readonly<Record<AccountingSourceKind, string>> = {
    vietcombank: "srcVietcombank",
    manual: "srcManual",
    inbox: "srcInbox",
    other: "srcOther",
}

/** Catalog key of a credit's source. */
export const sourceKeyOf = (kind: AccountingSourceKind): string => SOURCE_KEYS[kind]

const MATCH_TONES: Readonly<Record<AccountingMatchState, AccountingTone>> = {
    matched: "success",
    unclear: "warning",
    unmatched: "neutral",
}

/** Tone of a credit's match state. */
export const matchToneOf = (match: AccountingMatchState): AccountingTone => MATCH_TONES[match]

const INVOICE_TONES: Readonly<Record<AccountingInvoiceStatus, AccountingTone>> = {
    draft: "neutral",
    issued: "warning",
    paid: "success",
    void: "neutral",
}

/** Tone of an invoice's status. */
export const invoiceToneOf = (status: AccountingInvoiceStatus): AccountingTone => INVOICE_TONES[status]

const LEDGER_TONES: Readonly<Record<AccountingLedgerStatus, AccountingTone>> = {
    issued: "warning",
    paid: "success",
    settled: "neutral",
    void: "neutral",
    matched: "success",
    unmatched: "neutral",
    needs_review: "warning",
}

/** Tone of a ledger line's status. */
export const ledgerToneOf = (status: AccountingLedgerStatus): AccountingTone => LEDGER_TONES[status]

const STEP_STATUSES: ReadonlyArray<string> = [
    "draft",
    "issued",
    "paid",
    "void",
    "confirmed",
    "invoiced",
    "cancelled",
    "matched",
    "unmatched",
    "needs_review",
    "auto_done",
    "approved",
    "edited",
    "rejected",
]
const STEP_ACTIONS: ReadonlyArray<string> = ["issue_invoice", "reconcile_payment"]

/** One step of a lineage, as plain words ready for the timeline. */
export interface AccountingLineageItem {
    readonly id: string
    readonly title: string
    readonly dateTime: string | null
    readonly timeLabel: string | null
    readonly kindLabel: string
    readonly isCorrection: boolean
    readonly amountText: string | null
    readonly statusText: string | null
    readonly detail: string | null
}

/** The amount a step shows: a correction says what the amount should be. */
const stepAmountOf = (
    t: AccountingTranslator,
    format: AccountingFormat,
    step: AccountingLineageStep,
): string | null => {
    if (step.amount === null) return null
    const amount = moneyOf(format, step.amount)
    return step.kind === "adjustment" ? t("correctedTo", { amount }) : amount
}

/** Turns lineage steps into the words the timeline draws. */
export const lineageItemsOf = (
    t: AccountingTranslator,
    format: AccountingFormat,
    steps: ReadonlyArray<AccountingLineageStep>,
): ReadonlyArray<AccountingLineageItem> =>
    steps.map((step, position) => ({
        id: `${step.kind}-${position}`,
        title: step.kind === "decision" && STEP_ACTIONS.includes(step.title) ? t(`action_${step.title}`) : step.title,
        dateTime: step.at,
        timeLabel: step.at === null ? null : accountingStampOf(format, step.at),
        kindLabel: t(`step_${step.kind}`),
        isCorrection: step.kind === "adjustment",
        amountText: stepAmountOf(t, format, step),
        statusText: step.status !== null && STEP_STATUSES.includes(step.status) ? t(`stepStatus_${step.status}`) : null,
        detail: step.detail,
    }))
