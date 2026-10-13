import type { Database } from "../../../../../../../supabase/types/database.types"
import type { SalesContract, SalesContractStatus } from "@/modules/types"

/** One generated row of public.contracts. */
export type ContractsRow = Database["public"]["Tables"]["contracts"]["Row"]

const CONTRACT_STATUSES: ReadonlyArray<SalesContractStatus> = ["active", "ended", "cancelled"]

/** One contract row as the workbench reads it. */
export const toContract = (row: ContractsRow): SalesContract => ({
    id: row.id,
    workspace_id: row.workspace_id,
    lead_id: row.lead_id,
    customer_name: row.customer_name,
    plan: row.plan,
    starts_on: row.starts_on,
    ends_on: row.ends_on,
    amount_vnd: row.amount_vnd,
    status: CONTRACT_STATUSES.find((status) => status === row.status) ?? "active",
    note: row.note,
    created_at: row.created_at,
    updated_at: row.updated_at,
})

type ContractParse =
    | { readonly success: true; readonly data: ContractFields }
    | { readonly success: false }

/** What saving a contract takes, bounded. */
export interface ContractFields {
    readonly id: string | null
    readonly workspaceId: string
    readonly leadId: string | null
    readonly customerName: string
    readonly plan: string
    readonly startsOn: string
    readonly endsOn: string
    readonly amountVnd: number | null
    readonly status: SalesContractStatus
    readonly note: string
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu
const DAY = /^\d{4}-\d{2}-\d{2}$/u

const isUuid = (value: unknown): value is string => typeof value === "string" && UUID.test(value)
const isDay = (value: unknown): value is string => typeof value === "string" && DAY.test(value)
const textOf = (value: unknown, max: number): string | null =>
    typeof value === "string" && value.length <= max ? value : null

const idOrNull = (value: unknown): string | null | undefined => {
    if (value === null || value === undefined) return null
    return isUuid(value) ? value : undefined
}

const amountOf = (value: unknown): number | null | undefined => {
    if (value === null || value === undefined) return null
    return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined
}

/** Bounds the contract a person typed: real days, a known status, a whole non-negative amount. */
export const contractSchema = {
    safeParse: (input: unknown): ContractParse => {
        if (typeof input !== "object" || input === null) return { success: false }
        const fields = Object.fromEntries(Object.entries(input))
        const id = idOrNull(fields.id)
        const leadId = idOrNull(fields.leadId)
        const amountVnd = amountOf(fields.amountVnd)
        const customerName = textOf(fields.customerName, 200)
        const plan = textOf(fields.plan, 200)
        const note = textOf(fields.note, 600)
        const status = CONTRACT_STATUSES.find((candidate) => candidate === fields.status)
        const { workspaceId, startsOn, endsOn } = fields
        if (id === undefined || leadId === undefined || amountVnd === undefined) return { success: false }
        if (customerName === null || plan === null || note === null || status === undefined) return { success: false }
        if (!isUuid(workspaceId) || !isDay(startsOn) || !isDay(endsOn) || endsOn < startsOn) return { success: false }
        return {
            success: true,
            data: { id, workspaceId, leadId, customerName, plan, startsOn, endsOn, amountVnd, status, note },
        }
    },
}
