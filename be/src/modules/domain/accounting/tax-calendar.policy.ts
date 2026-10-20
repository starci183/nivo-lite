import type {
    GatewayPayable,
    PayableDue,
    SupplierOnFile,
    TaxDeadline,
    TaxProfile,
    UpcomingDue,
} from "./accounting-desk.contracts"
import { TAX_BASIS } from "./messages/accounting-desk.messages"
import { DATED_HOLIDAYS, FIXED_HOLIDAYS } from "./vn-holidays.contracts"

const DAY_MS = 86_400_000

const BASIS = TAX_BASIS

const pad = (value: number): string => String(value).padStart(2, "0")

/** `YYYY-MM-DD` of a UTC calendar date. */
const isoOf = (year: number, month: number, day: number): string => `${year}-${pad(month)}-${pad(day)}`

const toMs = (iso: string): number => Date.parse(`${iso}T00:00:00Z`)

/** The calendar date `days` after `iso` (negative goes back). */
export const addDays = (iso: string, days: number): string =>
    new Date(toMs(iso) + days * DAY_MS).toISOString().slice(0, 10)

/** Whole days from `from` to `to`. */
export const daysBetween = (from: string, to: string): number => Math.round((toMs(to) - toMs(from)) / DAY_MS)

/** False on Saturdays, Sundays and public holidays. */
export const isWorkingDay = (iso: string): boolean => {
    const weekday = new Date(toMs(iso)).getUTCDay()
    if (weekday === 0 || weekday === 6) return false
    return !FIXED_HOLIDAYS.includes(iso.slice(5)) && !DATED_HOLIDAYS.includes(iso)
}

/** A deadline falling on a day off moves to the next working day (Civil Code 2015 art. 148, Circular 80/2021 art. 86). */
export const nextWorkingDay = (iso: string): string => {
    let day = iso
    while (!isWorkingDay(day)) day = addDays(day, 1)
    return day
}

const lastDayOf = (year: number, month: number): number => new Date(Date.UTC(year, month, 0)).getUTCDate()

/** The month after `month` of `year`, as [year, month]. */
const followingMonth = (year: number, month: number): [number, number] =>
    month === 12 ? [year + 1, 1] : [year, month + 1]

const deadline = (kind: TaxDeadline["kind"], period: string, statutory: string, basis: string): TaxDeadline => ({
    kind,
    period,
    dueOn: nextWorkingDay(statutory),
    basis,
})

const monthlyDeadlines = (profile: TaxProfile, year: number): Array<TaxDeadline> =>
    Array.from({ length: 12 }, (_, index) => index + 1).flatMap((month) => {
        const [dueYear, dueMonth] = followingMonth(year, month)
        const period = `${year}-${pad(month)}`
        const statutory = isoOf(dueYear, dueMonth, 20)
        const vat = deadline("vat", period, statutory, BASIS.vatMonthly)
        return profile.withholdsPit ? [vat, deadline("pit", period, statutory, BASIS.vatMonthly)] : [vat]
    })

const quarterlyDeadlines = (profile: TaxProfile, year: number): Array<TaxDeadline> =>
    [1, 2, 3, 4].flatMap((quarter) => {
        const [dueYear, dueMonth] = followingMonth(year, quarter * 3)
        const period = `${year}-Q${quarter}`
        const lastDay = isoOf(dueYear, dueMonth, lastDayOf(dueYear, dueMonth))
        const rows = [deadline("cit_provisional", period, isoOf(dueYear, dueMonth, 30), BASIS.citProvisional)]
        if (profile.vatPeriod === "quarterly") {
            rows.push(deadline("vat", period, lastDay, BASIS.vatQuarterly))
            if (profile.withholdsPit) rows.push(deadline("pit", period, lastDay, BASIS.vatQuarterly))
        }
        return rows
    })

const yearlyDeadlines = (profile: TaxProfile, year: number): Array<TaxDeadline> => {
    const finalizationDue = isoOf(year + 1, 3, 31)
    const rows = [deadline("cit_finalization", String(year), finalizationDue, BASIS.finalization)]
    if (profile.withholdsPit) rows.push(deadline("pit_finalization", String(year), finalizationDue, BASIS.finalization))
    if (profile.paysLicenseFee && year > profile.establishedYear) {
        rows.push(deadline("license_fee", String(year), isoOf(year, 1, 30), BASIS.licenseFee))
    }
    return rows
}

/** Every statutory deadline of the profile due between `from` and `to` (inclusive), soonest first. */
export const taxDeadlines = (profile: TaxProfile, from: string, to: string): Array<TaxDeadline> => {
    const first = Number(from.slice(0, 4)) - 1
    const last = Number(to.slice(0, 4))
    const rows: Array<TaxDeadline> = []
    for (let year = first; year <= last; year += 1) {
        if (profile.vatPeriod === "monthly") rows.push(...monthlyDeadlines(profile, year))
        rows.push(...quarterlyDeadlines(profile, year), ...yearlyDeadlines(profile, year))
    }
    return rows
        .filter((row) => row.dueOn >= from && row.dueOn <= to)
        .sort((a, b) => a.dueOn.localeCompare(b.dueOn) || a.kind.localeCompare(b.kind))
}

/** The due date of a supplier invoice: the invoice date plus the payment term, moved to a working day. */
export const supplierDueOn = (issuedOn: string, termDays: number): string => nextWorkingDay(addDays(issuedOn, termDays))

/** Tax deadlines and supplier payments due within `horizonDays` of `today` (overdue payables included), soonest first. */
export const upcomingDues = (
    profile: TaxProfile,
    payables: ReadonlyArray<PayableDue>,
    today: string,
    horizonDays: number,
): Array<UpcomingDue> => {
    const until = addDays(today, horizonDays)
    const taxes: Array<UpcomingDue> = taxDeadlines(profile, today, until).map((row) => ({
        source: "tax",
        kind: row.kind,
        ref: row.period,
        dueOn: row.dueOn,
        daysLeft: daysBetween(today, row.dueOn),
        amountVnd: null,
        note: row.basis,
    }))
    const bills: Array<UpcomingDue> = payables
        .filter((row) => row.dueOn <= until)
        .map((row) => ({
            source: "supplier",
            kind: "supplier_payment",
            ref: row.invoiceNo,
            dueOn: row.dueOn,
            daysLeft: daysBetween(today, row.dueOn),
            amountVnd: row.amountVnd,
            note: row.supplier,
        }))
    return [...taxes, ...bills].sort((a, b) => a.dueOn.localeCompare(b.dueOn) || a.ref.localeCompare(b.ref))
}

/** The dues a reminder goes out for today: `reminderDays` before, the day before, and the day itself. */
export const remindersToday = (dues: ReadonlyArray<UpcomingDue>, reminderDays: number): Array<UpcomingDue> =>
    dues.filter((row) => row.daysLeft === reminderDays || row.daysLeft === 1 || row.daysLeft === 0)

/** The due date of each supplier invoice still to pay: the supplier's own term on file (by tax code) or the default term. */
export const payablesDue = (
    payables: ReadonlyArray<GatewayPayable>,
    suppliers: ReadonlyArray<SupplierOnFile>,
    defaultTermDays: number,
): Array<PayableDue> =>
    payables.map((payable) => {
        const term =
            suppliers.find((supplier) => supplier.taxCode === payable.sellerTaxCode)?.termDays ?? defaultTermDays
        return {
            supplier: payable.supplier,
            invoiceNo: payable.invoiceNo,
            amountVnd: payable.amountVnd,
            dueOn: supplierDueOn(payable.issuedOn, term),
        }
    })
