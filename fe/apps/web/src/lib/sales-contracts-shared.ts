/** Client-safe facts about recurring contracts (the Sales workbench list and the renewal automation share them). No I/O. */
export const CONTRACT_STATUSES = ["active", "ended", "cancelled"] as const
export type ContractStatus = (typeof CONTRACT_STATUSES)[number]
export const isContractStatus = (v: unknown): v is ContractStatus =>
    typeof v === "string" && (CONTRACT_STATUSES as ReadonlyArray<string>).includes(v)

export type Contract = {
    id: string
    workspace_id: string
    lead_id: string | null
    customer_name: string
    plan: string
    /** YYYY-MM-DD */
    starts_on: string
    /** YYYY-MM-DD */
    ends_on: string
    amount_vnd: number | null
    status: ContractStatus
    note: string
    created_at: string
    updated_at: string
}

/** What the contract form submits. Dates are YYYY-MM-DD, the amount is whole dong. */
export type ContractInput = {
    readonly id?: string
    readonly leadId: string | null
    readonly customerName: string
    readonly plan: string
    readonly startsOn: string
    readonly endsOn: string
    readonly amountVnd: number | null
    readonly status: ContractStatus
    readonly note: string
}

const DAY = 86_400_000

export const isIsoDay = (v: string): boolean =>
    /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) &&
    new Date(`${v}T00:00:00Z`).toISOString().startsWith(v)

/** Whole days from `today` to `endsOn` (both YYYY-MM-DD); negative once the contract has ended. */
export const daysLeft = (endsOn: string, today: string): number =>
    Math.round((Date.parse(`${endsOn}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY)

/** "2026-10-31" as "31/10/2026". */
export const dayText = (iso: string): string =>
    isIsoDay(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : iso
