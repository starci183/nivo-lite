import type { BadgeTone } from "@starci/grammar/common"
import type { ContractForm, useSalesContractForm } from "@/hooks/rhf"
import type { useTranslations } from "next-intl"
import type { SalesContract, SalesContractStatus } from "@/modules/types"
const DAY = 86400000
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
/** One lead the contract can be linked to. */
export interface ContractLeadOption {
    readonly id: string
    readonly name: string
}
/** The first message of the form that is invalid, else null. */
export const firstContractError = (
    errors: ReturnType<typeof useSalesContractForm>["formState"]["errors"],
): string | null =>
    errors.customerName?.message ??
    errors.startsOn?.message ??
    errors.endsOn?.message ??
    errors.amount?.message ??
    errors.status?.message ??
    errors.plan?.message ??
    errors.note?.message ??
    null
/** What the open drawer shows: its words, the form values and the state of the save. */
interface DrawerViewInput {
    readonly isEditing: boolean
    readonly leads: ReadonlyArray<ContractLeadOption>
    readonly values: ContractForm
    readonly error: string | null
    readonly isPending: boolean
}
/** The words and values of the contract drawer. */
export const contractDrawerOf = (t: ReturnType<typeof useTranslations<"workbenchSales">>, input: DrawerViewInput) => {
    const { values } = input
    return {
        title: input.isEditing ? t("contractEditTitle") : t("contractAddTitle"),
        closeLabel: t("cancel"),
        saveLabel: t("save"),
        cancelLabel: t("cancel"),
        leadLabel: t("contractLead"),
        leadOptions: [
            { id: NO_LEAD, label: t("contractLeadNone") },
            ...input.leads.map((lead) => ({ id: lead.id, label: lead.name })),
        ],
        lead: values.leadId,
        customerLabel: t("contractCustomer"),
        customer: values.customerName,
        planLabel: t("contractPlan"),
        planHint: t("contractPlanHint"),
        plan: values.plan,
        startLabel: t("contractStart"),
        start: values.startsOn,
        endLabel: t("contractEnd"),
        endHint: t("contractEndHint"),
        end: values.endsOn,
        amountLabel: t("contractAmount"),
        amount: values.amount,
        statusLabel: t("contractStatus"),
        statusOptions: CONTRACT_STATUS_KEYS.map((status) => ({
            id: status,
            label: t(`contractStatus_${status}`),
        })),
        status: values.status,
        noteLabel: t("contractNote"),
        note: values.note,
        error: input.error,
        isPending: input.isPending,
        canSave: values.customerName.trim() !== "" && values.endsOn.trim() !== "",
    }
}
export { CONTRACT_IMPORT_FIELDS } from "@/modules/sales"
export type { ContractImportField } from "@/modules/sales"
