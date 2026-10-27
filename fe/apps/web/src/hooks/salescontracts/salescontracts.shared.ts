import { parseDate } from "@internationalized/date"
import type { BadgeTone } from "@starci/grammar/common"
import type { ContractForm } from "@/hooks/rhf"
import type { SalesContract, SalesContractStatus } from "@/modules/types"

const DAY = 86_400_000

/** The statuses a recurring contract can hold, in the order the form lists them. */
export const CONTRACT_STATUS_KEYS: ReadonlyArray<SalesContractStatus> = ["active", "ended", "cancelled"]

/** The badge tone of each contract status. */
export const CONTRACT_TONES: Readonly<Record<SalesContractStatus, BadgeTone>> = {
    active: "success",
    ended: "neutral",
    cancelled: "danger",
}

/** True for a real calendar day written YYYY-MM-DD. */
const isIsoDay = (value: string): boolean =>
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().startsWith(value)

/** Whole days from `today` to `endsOn` (both YYYY-MM-DD); negative once the contract has ended. */
export const contractDaysLeft = (endsOn: string, today: string): number =>
    Math.round((Date.parse(`${endsOn}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY)

/** 2026-10-31 as 31/10/2026. */
export const isoDayText = (iso: string): string =>
    isIsoDay(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : iso

/** The option of a contract form that links it to no lead. */
export const NO_LEAD = "none"

/** The stored YYYY-MM-DD as a date value; an empty or malformed text is no date. */
export const contractDateOf = (text: string) => {
    try {
        return text ? parseDate(text) : null
    } catch {
        return null
    }
}

/** Narrows a typed text to a contract status; anything else is active. */
export const contractStatusOf = (value: string): SalesContractStatus =>
    CONTRACT_STATUS_KEYS.find((status) => status === value) ?? "active"

/** The form of a new contract, or the filled form of an existing one. */
export const contractFormOf = (editing: SalesContract | null, today: string): ContractForm => ({
    leadId: editing?.lead_id ?? NO_LEAD,
    customerName: editing?.customer_name ?? "",
    plan: editing?.plan ?? "",
    startsOn: editing?.starts_on ?? today,
    endsOn: editing?.ends_on ?? "",
    amount: editing?.amount_vnd == null ? "" : String(editing.amount_vnd),
    status: editing?.status ?? "active",
    note: editing?.note ?? "",
})

/** The contract fields a column can fill, in the order the dialog lists them. */
export const CONTRACT_IMPORT_FIELDS = [
    "customerName",
    "plan",
    "startsOn",
    "endsOn",
    "amountVnd",
    "status",
    "note",
] as const

/** One contract field a column can fill. */
export type ContractImportField = (typeof CONTRACT_IMPORT_FIELDS)[number]
