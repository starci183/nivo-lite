import type { useFormatter, useTranslations } from "next-intl"
import { splitBasis } from "@/hooks/decisions"
import { canDecideItem, type useMember } from "@/hooks/member"
import type { useSalesDecisionForm } from "@/hooks/rhf"
import { ageParts, decisionAnchor, isStale, OUTCOME_TONES, parseAmount, type useSalesActions } from "@/hooks/sales"
import type { SalesWorkEditsRequest } from "@/hooks/swr"
import type { useSalesWorkbench } from "@/hooks/salesworkbench"
import { leadPath } from "@/modules/routes"
import type { FlowDecisionRow, SalesDecision, TypedDecisionValues } from "@/modules/types"
import { fieldKey } from "@/modules/utils"
import { actionWordOf } from "@/hooks/actionWord"

type Decision = "approved" | "rejected"

/** Captures non-empty missing fields and preserves their parsed amount separately. */
const missingEditsOf = (item: SalesDecision, typed: TypedDecisionValues) => {
    const fields: Record<string, string | number | null> = {}
    let amount: number | null | undefined
    for (const name of item.missing) {
        const raw = (typed.values[fieldKey(item.id, name)] ?? "").trim()
        if (!raw) continue
        const value = name === "amount_vnd" ? parseAmount(raw) : raw
        fields[name] = value
        if (name === "amount_vnd") amount = parseAmount(raw)
    }
    return { fields, amount }
}

/** Captures changes in the optional editor without replacing untouched values. */
const editorEditsOf = (item: SalesDecision, typed: TypedDecisionValues) => {
    let draft: string | undefined
    let amount: number | null | undefined
    if (!typed.editing[item.id]) return { draft, amount }
    const typedDraft = (typed.drafts[item.id] ?? item.draft).trim()
    if (typedDraft && typedDraft !== item.draft) draft = typedDraft
    if (item.hasAmount && !item.missing.includes("amount_vnd")) {
        const originalAmount = item.amountVnd === null ? "" : String(item.amountVnd)
        const typedAmount = parseAmount(typed.amounts[item.id] ?? originalAmount)
        if (typedAmount !== item.amountVnd) amount = typedAmount
    }
    return { draft, amount }
}

/** The edits a person made to a pending decision (filled fields, the draft, the amount), or undefined when nothing changed. */
export const editsOf = (item: SalesDecision, typed: TypedDecisionValues): SalesWorkEditsRequest | undefined => {
    const missing = missingEditsOf(item, typed)
    const editor = editorEditsOf(item, typed)
    const amount = editor.amount === undefined ? missing.amount : editor.amount
    const { draft } = editor
    const edits: SalesWorkEditsRequest = {
        ...(draft === undefined ? {} : { draft }),
        ...(amount === undefined ? {} : { amount_vnd: amount }),
        ...(Object.keys(missing.fields).length > 0
            ? {
                  fields: Object.entries(missing.fields).map(([name, value]) =>
                      typeof value === "number" ? { name, number: value } : { name, text: value },
                  ),
              }
            : {}),
    }
    return Object.keys(edits).length > 0 ? edits : undefined
}

/** The words of a message that has any, else null. */
const textOrNull = (text: string | undefined): string | null => (text === undefined || text === "" ? null : text)

/** Values and callbacks already read by the connected decision surface. */
export type SalesDecisionsControllerInput = {
    readonly props: { readonly focusId: string | null }
    readonly t: ReturnType<typeof useTranslations<"workbenchSales">>
    readonly g: ReturnType<typeof useTranslations<"governance">>
    readonly format: ReturnType<typeof useFormatter>
    readonly me: ReturnType<typeof useMember>
    readonly actions: ReturnType<typeof useSalesActions>
    readonly data: ReturnType<typeof useSalesWorkbench>["data"]
    readonly nowIso: ReturnType<typeof useSalesWorkbench>["nowIso"]
    readonly pending: NonNullable<NonNullable<ReturnType<typeof useSalesWorkbench>["data"]>["decisions"]>
    readonly decided: NonNullable<NonNullable<ReturnType<typeof useSalesWorkbench>["data"]>["decided"]>
    readonly decisionForm: ReturnType<typeof useSalesDecisionForm>
    readonly busy: { readonly id: string; readonly decision: Decision } | null
    readonly setBusy: React.Dispatch<React.SetStateAction<{ readonly id: string; readonly decision: Decision } | null>>
    readonly typed: ReturnType<typeof useSalesDecisionForm>["typed"]
    readonly errors: Readonly<Record<string, string>>
    readonly setErrors: React.Dispatch<React.SetStateAction<Readonly<Record<string, string>>>>
    readonly active: { readonly id: string; readonly decision: Decision } | null
}

/** Adds the connected owner's field-label resolver to its snapshot. */
export type SalesDecisionRowInput = SalesDecisionsControllerInput & { readonly fieldLabel: (name: string) => string }

const amountLineOf = (
    item: SalesDecision,
    isEditing: boolean,
    format: SalesDecisionsControllerInput["format"],
): string | null => {
    if (!item.hasAmount || item.missing.includes("amount_vnd") || isEditing) return null
    if (item.amountVnd === null) return "—"
    return format.number(item.amountVnd, { style: "currency", currency: "VND", maximumFractionDigits: 0 })
}

/** Resolves one pending decision using the connected form snapshot. */
export const pendingSalesRow = (item: SalesDecision, input: SalesDecisionRowInput) => {
    const { props, t, g, me, actions, nowIso, typed, errors, active, fieldLabel } = input
    const isEditing = typed.editing[item.id] ?? false
    const age = ageParts(item.createdAt, nowIso)
    const amountMissing = item.missing.includes("amount_vnd")
    const isIncomplete = item.missing.some((name) => !(typed.values[fieldKey(item.id, name)] ?? "").trim())
    const mine = active?.id === item.id ? active.decision : null
    return {
        id: item.id,
        anchor: decisionAnchor(item.id),
        isFocused: props.focusId === item.id,
        badge: item.reason ? g(`reason_${item.reason}`) : t("kind_decision"),
        age: age.unit === "now" ? t("ageNow") : t(`age_${age.unit}`, { n: age.n }),
        isStale: isStale(item.createdAt, nowIso),
        customer: item.customer,
        leadHref: item.leadId === null ? null : leadPath(item.leadId),
        actionLabel: actionWordOf(g, item.action),
        summary: item.summary,
        reasonHint: item.reason && item.reason !== "routine" ? g(`reasonHint_${item.reason}`) : null,
        amountLine: amountLineOf(item, isEditing, input.format),
        draft: item.draft && !isEditing ? item.draft : null,
        canAct: canDecideItem(me, item.assignedStaffId),
        assignedTo: item.assignedStaffName ? t("assignedTo", { name: item.assignedStaffName }) : null,
        missing: item.missing.map((name) => ({
            name,
            label: fieldLabel(name),
            value: typed.values[fieldKey(item.id, name)] ?? "",
        })),
        isEditing,
        draftValue: typed.drafts[item.id] ?? item.draft,
        showDraftField: isEditing && item.draft !== "",
        amountValue: typed.amounts[item.id] ?? (item.amountVnd !== null ? String(item.amountVnd) : ""),
        showAmountField: isEditing && item.hasAmount && !amountMissing,
        canEdit: item.draft !== "" || item.hasAmount,
        isBusy: actions.isMutating,
        isApproveBusy: mine === "approved",
        isRejectBusy: mine === "rejected",
        isApproveDisabled: actions.isMutating || isIncomplete,
        editLabel: isEditing ? t("editDone") : t("edit"),
        error: textOrNull(errors[item.id]),
    }
}

/** Resolves a completed decision and its attribution. */
export const decidedSalesRow = (row: FlowDecisionRow, input: SalesDecisionsControllerInput) => {
    const { t, g, format } = input
    const { basis, rest } = splitBasis(row.note)
    return {
        id: row.id,
        action: actionWordOf(g, row.action),
        outcomeLabel: g(`outcome_${row.outcome}`),
        outcomeTone: OUTCOME_TONES[row.outcome],
        customer: row.lead_id ? (row.leadName ?? t("openCustomer")) : "",
        href: row.lead_id ? leadPath(row.lead_id) : null,
        byline: t("decidedBy", {
            who: row.decider_kind === "policy" ? g("decider_policy") : row.decided_by,
            time: format.dateTime(new Date(row.created_at), {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
            }),
        }),
        basis: basis ? t("basis", { basis }) : null,
        rest: rest || null,
    }
}
