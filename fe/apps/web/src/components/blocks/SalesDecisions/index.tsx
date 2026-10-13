"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useEffect, useState, useTransition } from "react"
import { splitBasis } from "@/hooks/decisions"
import { canDecideItem, useMember } from "@/hooks/member"
import { ageParts, decisionAnchor, isStale, KNOWN_FIELDS, OUTCOME_TONES } from "@/hooks/sales"
import { EMPTY_TYPED, editsOf, fieldKey } from "@/hooks/salesdecisions"
import type { TypedDecisionValues } from "@/hooks/salesdecisions"
import type { DecisionRow } from "@/lib/flow-types"
import { navigation } from "@/modules/i18n"
import { writeDecideDraft, writeDecideWorkItem } from "@/modules/db/sales/write-sales-actions"
import { leadPath } from "@/modules/routes"
import type { SalesDecision } from "@/modules/types"
import { SalesDecisionsBase } from "./component"
import type { DecidedView } from "./component"
import type { DecisionRowView } from "@/components/composites/SalesDecisionRow"

/** The decisions waiting, those already made and the one to highlight. */
interface SalesDecisionsProps {
    readonly pending: ReadonlyArray<SalesDecision>
    readonly decided: ReadonlyArray<DecisionRow>
    readonly nowIso: string
    /** The decision to scroll to and highlight (set when opened from the Attention surface). */
    readonly focusId: string | null
}

type Decision = "approved" | "rejected"

/** The decisions surface: the typed values, the edit toggles and the decisions themselves live here, the drawing in the pure half. */
export const SalesDecisions = (props: SalesDecisionsProps) => {
    const t = useTranslations("workbenchSales")
    const g = useTranslations("governance")
    const format = useFormatter()
    const router = navigation.useRouter()
    const me = useMember()
    const [isPending, startTransition] = useTransition()
    const [busy, setBusy] = useState<{ readonly id: string; readonly decision: Decision } | null>(null)
    const [typed, setTyped] = useState<TypedDecisionValues>(EMPTY_TYPED)
    const [errors, setErrors] = useState<Readonly<Record<string, string>>>({})
    const active = isPending ? busy : null

    useEffect(() => {
        if (props.focusId === null) return
        document.getElementById(decisionAnchor(props.focusId))?.scrollIntoView({ block: "center", behavior: "smooth" })
    }, [props.focusId])

    const fieldLabel = (name: string): string =>
        KNOWN_FIELDS.some((known) => known === name) ? g(`field_${name}`) : name
    const decide = (id: string, decision: Decision) => {
        const item = props.pending.find((candidate) => candidate.id === id)
        if (item === undefined) return
        setErrors((previous) => ({ ...previous, [id]: "" }))
        setBusy({ id, decision })
        startTransition(async () => {
            const draft = (typed.drafts[id] ?? item.draft).trim()
            const edited = decision === "approved" && typed.editing[id] && draft !== item.draft ? draft : undefined
            const result =
                item.source === "execution" && item.executionId
                    ? await writeDecideDraft({ id: item.executionId, decision, editedDraft: edited })
                    : await writeDecideWorkItem({
                          id: item.id,
                          decision,
                          edits: decision === "approved" ? editsOf(item, typed) : undefined,
                      })
            if (result.kind === "ok") {
                setTyped((previous) => ({ ...previous, editing: { ...previous.editing, [id]: false } }))
                router.refresh()
            } else
                setErrors((previous) => ({
                    ...previous,
                    [id]: t("actionFailed", { error: result.kind === "unavailable" ? result.code : result.kind }),
                }))
            setBusy(null)
        })
    }

    const amountLineOf = (item: SalesDecision, isEditing: boolean): string | null => {
        if (!item.hasAmount || item.missing.includes("amount_vnd") || isEditing) return null
        if (item.amountVnd === null) return "—"
        return format.number(item.amountVnd, { style: "currency", currency: "VND", maximumFractionDigits: 0 })
    }
    const rowOf = (item: SalesDecision): DecisionRowView => {
        const isEditing = typed.editing[item.id] ?? false
        const age = ageParts(item.createdAt, props.nowIso)
        const amountMissing = item.missing.includes("amount_vnd")
        const isIncomplete = item.missing.some((name) => !(typed.values[fieldKey(item.id, name)] ?? "").trim())
        const mine = active?.id === item.id ? active.decision : null
        return {
            id: item.id,
            anchor: decisionAnchor(item.id),
            isFocused: props.focusId === item.id,
            badge: item.reason ? g(`reason_${item.reason}`) : t("kind_decision"),
            age: age.unit === "now" ? t("ageNow") : t(`age_${age.unit}`, { n: age.n }),
            isStale: isStale(item.createdAt, props.nowIso),
            customer: item.customer,
            leadHref: item.leadId === null ? null : leadPath(item.leadId),
            actionLabel: item.action === "follow_up" ? g("action_send_follow_up") : g(`action_${item.action}`),
            summary: item.summary,
            reasonHint: item.reason && item.reason !== "routine" ? g(`reasonHint_${item.reason}`) : null,
            amountLine: amountLineOf(item, isEditing),
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
            isBusy: active !== null,
            isApproveBusy: mine === "approved",
            isRejectBusy: mine === "rejected",
            isApproveDisabled: active !== null || isIncomplete,
            editLabel: isEditing ? t("editDone") : t("edit"),
            error: errors[item.id] ? errors[item.id] : null,
        }
    }
    const decidedOf = (row: DecisionRow): DecidedView => {
        const { basis, rest } = splitBasis(row.note)
        return {
            id: row.id,
            action: g(`action_${row.action}`),
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

    return (
        <SalesDecisionsBase
            props={{
                pendingLabel: t("pendingTitle"),
                emptyTitle: t("decisionsEmptyTitle"),
                emptyBody: t("decisionsEmptyBody"),
                decidedTitle: t("decidedTitle"),
                decidedBody: t("decidedBody"),
                decidedEmptyTitle: t("decidedEmptyTitle"),
                decidedEmptyBody: t("decidedEmptyBody"),
                pending: props.pending.map(rowOf),
                decided: props.decided.map(decidedOf),
                rowLabels: {
                    draftLabel: t("draftLabel"),
                    waitingManager: t("waitingManager"),
                    amountLabel: g("field_amount_vnd"),
                    approveLabel: t("approve"),
                    rejectLabel: t("reject"),
                },
            }}
            on={{
                field: (id, name, value) =>
                    setTyped((previous) => ({
                        ...previous,
                        values: { ...previous.values, [fieldKey(id, name)]: value },
                    })),
                draft: (id, value) =>
                    setTyped((previous) => ({ ...previous, drafts: { ...previous.drafts, [id]: value } })),
                amount: (id, value) =>
                    setTyped((previous) => ({ ...previous, amounts: { ...previous.amounts, [id]: value } })),
                toggleEdit: (id) =>
                    setTyped((previous) => ({
                        ...previous,
                        editing: { ...previous.editing, [id]: !previous.editing[id] },
                    })),
                decide,
            }}
        />
    )
}
