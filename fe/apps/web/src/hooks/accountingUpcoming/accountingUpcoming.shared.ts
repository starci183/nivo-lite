import type { AccountingUpcomingDue } from "@/modules/types"
import { dayOf, moneyOf } from "@/modules/utils"
import type { AccountingFormat, AccountingTranslator } from "@/modules/utils"
import { CONSOLE_ROUTES } from "@/modules/routes"

/** How near a due date is: past, within the reminder days, or further off. */
export type AccountingDueTone = "danger" | "warning" | "neutral"

/** One due of the Upcoming list, in the reader's words. */
export interface AccountingUpcomingRow {
    readonly id: string
    readonly title: string
    readonly description: string
    readonly badge: string
    readonly tone: AccountingDueTone
}

/** The label of each tax obligation, by the key the catalogue holds it under. */
const OBLIGATION_KEYS: Readonly<Record<string, string>> = {
    vat: "obligation_vat",
    pit: "obligation_pit",
    cit_provisional: "obligation_cit_provisional",
    cit_finalization: "obligation_cit_finalization",
    pit_finalization: "obligation_pit_finalization",
    license_fee: "obligation_license_fee",
}

const MONTH_PERIOD = /^(\d{4})-(\d{2})$/u
const QUARTER_PERIOD = /^(\d{4})-Q(\d)$/u

/** The period a tax deadline covers as people write it: 10/2026, Q3/2026 or the year. */
export const periodOf = (ref: string): string => {
    const month = MONTH_PERIOD.exec(ref)
    if (month !== null) return `${month[2]}/${month[1]}`
    const quarter = QUARTER_PERIOD.exec(ref)
    return quarter === null ? ref : `Q${quarter[2]}/${quarter[1]}`
}

/** The badge of a due date: how many days are left, warning within the reminder days and danger once past. */
const badgeOf = (
    t: AccountingTranslator,
    due: AccountingUpcomingDue,
    reminderDays: number | null,
): { readonly badge: string; readonly tone: AccountingDueTone } => {
    if (due.daysLeft < 0) return { badge: t("dueOverdue", { n: -due.daysLeft }), tone: "danger" }
    const tone = reminderDays !== null && due.daysLeft <= reminderDays ? "warning" : "neutral"
    return { badge: due.daysLeft === 0 ? t("dueToday") : t("dueIn", { n: due.daysLeft }), tone }
}

/** The title and the supporting line of a due: a tax deadline with its legal basis, or a supplier invoice with its amount. */
const wordsOf = (
    t: AccountingTranslator,
    format: AccountingFormat,
    due: AccountingUpcomingDue,
): { readonly title: string; readonly description: string } => {
    const date = t("dueOn", { date: dayOf(format, `${due.dueOn}T00:00:00+07:00`) })
    if (due.source === "supplier") {
        return {
            title: `${due.note || t("supplierUnknown")} · ${t("supplierInvoiceNo", { no: due.ref })}`,
            description: [date, moneyOf(format, due.amountVnd)].join(" · "),
        }
    }
    const obligation = t(OBLIGATION_KEYS[due.kind] ?? "obligation_other")
    return { title: `${obligation} ${periodOf(due.ref)}`, description: `${date} · ${due.note}` }
}

/** The dues of the next days as rows: soonest first, as the back end sorts them. */
export const accountingUpcomingRowsOf = (
    t: AccountingTranslator,
    format: AccountingFormat,
    dues: ReadonlyArray<AccountingUpcomingDue>,
    reminderDays: number | null,
): ReadonlyArray<AccountingUpcomingRow> =>
    dues.map((due) => ({
        id: `${due.source}:${due.kind}:${due.ref}`,
        ...wordsOf(t, format, due),
        ...badgeOf(t, due, reminderDays),
    }))

/** The block that says supplier invoices need an invoice connector, with the one place to connect it; null once one is connected. */
export const supplierNeedOf = (t: AccountingTranslator, payablesSource: string | null) =>
    payablesSource === null
        ? {
              title: t("supplierNeedTitle"),
              body: t("supplierNeedBody"),
              badge: t("notConnected"),
              actionLabel: t("openConnections"),
              actionHref: CONSOLE_ROUTES.connections,
          }
        : null
