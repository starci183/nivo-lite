import type { FieldErrors } from "react-hook-form"
import type { AccountingQuestionValues, AccountingQuestionCardData } from "@/modules/types"
import type { FlowWorkItemView } from "@/modules/types"
import type { MutateDecideWorkItemRequest } from "@/modules/api/graphql/mutations/mutation-decide-work-item"
import { digitsToNumber, moneyOf, accountingStampOf } from "./accounting"
import type { AccountingFormat, AccountingTranslator } from "./accounting"

/** Sends the changed proposal fields in the generated decision request shape. */
export const accountingQuestionEdits = (
    item: FlowWorkItemView,
    values: AccountingQuestionValues,
): MutateDecideWorkItemRequest["edits"] => {
    const edits: NonNullable<MutateDecideWorkItemRequest["edits"]> = {
        fields: item.missing_fields.map((name) => {
            if (name === "amount_vnd") return { name, number: digitsToNumber(values.fields[name] ?? "") }
            return { name, text: values.fields[name]?.trim() ?? "" }
        }),
    }
    if (values.candidateId) edits.candidateId = values.candidateId
    if (values.draft.trim() !== (item.proposal.draft ?? "")) edits.draft = values.draft.trim()
    if (digitsToNumber(values.amount) !== (item.proposal.amount_vnd ?? null))
        edits.amount_vnd = digitsToNumber(values.amount)
    else if (item.missing_fields.includes("amount_vnd"))
        edits.amount_vnd = digitsToNumber(values.fields.amount_vnd ?? "")
    return edits
}

/** Selects the first localized validation failure of a decision form. */
export const accountingQuestionError = (errors: FieldErrors<AccountingQuestionValues>): string | null => {
    const error =
        errors.basis?.message ??
        errors.candidateId?.message ??
        errors.amount?.message ??
        errors.draft?.message ??
        Object.values(errors.fields ?? {}).find((failure) => failure?.message)?.message
    return typeof error === "string" ? error : null
}

/** The status word for an open or completed accounting proposal. */
export const accountingQuestionStatus = (
    item: FlowWorkItemView,
    t: AccountingTranslator,
    g: AccountingTranslator,
): string => {
    if (item.status === "failed") return g("status_failed")
    if (item.status === "rejected") return g("status_rejected")
    if (item.status !== "waiting_decision") return g("status_done")
    if (item.action === "reconcile_payment") return t("reconcileWaiting")
    if (item.reason) return g(`reason_${item.reason}`)
    return t("exceptionTitle")
}

/** The grammar tone of an accounting proposal's current status. */
export const accountingQuestionTone = (item: FlowWorkItemView): "danger" | "success" | "warning" => {
    if (item.status === "failed" || item.status === "rejected") return "danger"
    if (item.status === "waiting_decision") return "warning"
    return "success"
}

/** Starts a proposal form from the backend's current draft and amount. */
export const accountingQuestionDefaults = (item: FlowWorkItemView): AccountingQuestionValues => ({
    fields: Object.fromEntries(item.missing_fields.map((name) => [name, ""])),
    draft: item.proposal.draft ?? "",
    amount: item.proposal.amount_vnd == null ? "" : String(item.proposal.amount_vnd),
    candidateId: "",
    basis: "",
})

interface AccountingQuestionDisplayParams {
    readonly item: FlowWorkItemView
    readonly ownerName: string
    readonly values: AccountingQuestionValues
    readonly t: AccountingTranslator
    readonly g: AccountingTranslator
    readonly format: AccountingFormat
    readonly canAct: boolean
    readonly isBusy: boolean
    readonly isEditing: boolean
    readonly error: string | null
}

/** Resolves proposal copy and inputs into atoms for the accounting card. */
export const accountingQuestionDisplay = (params: AccountingQuestionDisplayParams): AccountingQuestionCardData => {
    const { item, ownerName, values, t, g, format, canAct, isBusy, isEditing, error } = params
    const isOpen = item.status === "waiting_decision" || item.status === "failed"
    const isFailed = item.status === "failed"
    const isReconcile = item.action === "reconcile_payment"
    const fields = item.missing_fields.map((name) => ({
        name,
        label: g.has(`field_${name}`) ? g(`field_${name}`) : name,
        value: values.fields?.[name] ?? "",
    }))
    const time = accountingStampOf(format, item.completed_at ?? item.updated_at)
    let footer: string | null = null
    if (item.assignedStaffName) footer = t("exceptionAssigned", { name: item.assignedStaffName, time })
    else if (!isOpen)
        footer = t("exceptionDecided", {
            status: accountingQuestionStatus(item, t, g),
            who: item.decidedBy || ownerName,
            time,
        })
    let explanation: string | null = null
    if (isFailed) explanation = item.error
    else if (item.reason && g.has(`reasonHint_${item.reason}`)) explanation = g(`reasonHint_${item.reason}`)
    const textOf = (name: string) => String(item.proposal.fields?.[name] ?? "")
    return {
        id: item.id,
        title: `${g(`action_${item.action}`)}${item.lead ? ` · ${item.lead.contact_name}` : ""}`,
        status: accountingQuestionStatus(item, t, g),
        statusTone: accountingQuestionTone(item),
        origin: item.origin === "simulated" ? t("simulatedTag") : null,
        explanation,
        proposalLabel: isFailed ? t("exceptionErrorLabel") : t("exceptionProposes"),
        summary: isFailed ? (item.error ?? item.proposal.summary) : item.proposal.summary,
        footer,
        isOpen,
        isFailed,
        canAct,
        isBusy,
        isEditing,
        waitingLabel: t("waitingManager"),
        draft: item.proposal.draft ? (values.draft ?? "") : null,
        draftLabel: t("exceptionDraft"),
        amount:
            item.proposal.amount_vnd != null && !item.missing_fields.includes("amount_vnd")
                ? (values.amount ?? "")
                : null,
        amountLabel: t("exceptionAmount"),
        missingLabel: t("exceptionMissing"),
        fields,
        candidateId: values.candidateId ?? "",
        candidateLabel: t("exceptionCandidates"),
        candidates: (item.proposal.candidates ?? []).map((candidate) => ({
            value: candidate.id,
            label: candidate.label,
            description: moneyOf(format, candidate.amount_vnd),
        })),
        reconcileCredit: isReconcile
            ? t("reconcileCreditLine", {
                  amount: moneyOf(format, item.proposal.amount_vnd),
                  payer: textOf("payer") || t("reconcileUnknown"),
                  ref: textOf("reference") || t("reconcileUnknown"),
              })
            : null,
        reconcileWarning: t("reconcileWarning"),
        basis: isReconcile ? (values.basis ?? "") : null,
        basisLabel: t("basisLabel"),
        basisHint: t("basisHint", { n: 10 }),
        basisPlaceholder: t("basisPlaceholder"),
        approveLabel: t(isEditing ? "exceptionSaveContinue" : "exceptionApprove"),
        rejectLabel: t("exceptionReject"),
        editLabel: t(isEditing ? "exceptionCancelEdit" : "exceptionEditContinue"),
        error,
        leadHref: item.lead ? item.href : null,
        leadLabel: t("exceptionOpenLead"),
    }
}
