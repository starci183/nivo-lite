import type { useFormatter, useTranslations } from "next-intl"
import type { splitBasis } from "@/hooks/decisions"
import type { canDecideItem, useMember } from "@/hooks/member"
import type { useSalesDecisionForm } from "@/hooks/rhf"
import type { ageParts, decisionAnchor, isStale, OUTCOME_TONES, useSalesActions } from "@/hooks/sales"
import type { fieldKey } from "@/hooks/salesdecisions"
import type { useSalesWorkbench } from "@/hooks/salesworkbench"
import type { SalesDecision, FlowDecisionRow } from "@/modules/types"
import { leadPath } from "@/modules/routes"
import { Badge, EmptyNotice, SectionHeader, SurfaceListCard, Text } from "@starci/grammar/common"
import type { BadgeTone } from "@starci/grammar/common"
import { SalesDecisionRow } from "@/components/composites/SalesDecisionRow"
import type { DecisionRowActions, DecisionRowLabels, DecisionRowView } from "@/components/composites/SalesDecisionRow"
import { SalesRow } from "@/components/branches/SalesRow"

/** One decision already made, every word already resolved. */
export interface DecidedView {
    readonly id: string
    readonly action: string
    readonly outcomeLabel: string
    readonly outcomeTone: BadgeTone
    readonly customer: string
    readonly href: string | null
    readonly byline: string
    readonly basis: string | null
    readonly rest: string | null
}

/** The words and data of the decisions surface. */
export interface SalesDecisionsBaseProps {
    readonly props: {
        readonly pendingLabel: string
        readonly emptyTitle: string
        readonly emptyBody: string
        readonly decidedTitle: string
        readonly decidedBody: string
        readonly decidedEmptyTitle: string
        readonly decidedEmptyBody: string
        readonly pending: ReadonlyArray<DecisionRowView>
        readonly rowLabels: DecisionRowLabels
        readonly decided: ReadonlyArray<DecidedView>
    }
    readonly on: DecisionRowActions
}

/** Surface 3: sales decisions waiting for a person, then the ones already made. */
export const SalesDecisionsBase = (props: SalesDecisionsBaseProps) => {
    const { props: p, on } = props
    return (
        <>
            <SurfaceListCard
                ariaLabel={p.pendingLabel}
                empty={<EmptyNotice message={p.emptyTitle} description={p.emptyBody} />}
            >
                {p.pending.map((row) => (
                    <SalesDecisionRow key={row.id} row={row} labels={p.rowLabels} on={on} />
                ))}
            </SurfaceListCard>
            <SectionHeader level={2} title={p.decidedTitle} description={p.decidedBody} />
            <SurfaceListCard
                ariaLabel={p.decidedTitle}
                empty={<EmptyNotice message={p.decidedEmptyTitle} description={p.decidedEmptyBody} />}
            >
                {p.decided.map((row) => (
                    <SalesRow
                        key={row.id}
                        chips={
                            <>
                                <Text as="span" weight="semibold">
                                    {row.action}
                                </Text>
                                <Badge tone={row.outcomeTone}>{row.outcomeLabel}</Badge>
                            </>
                        }
                        customer={row.customer}
                        customerHref={row.href}
                    >
                        <Text size="xs" tone="muted">
                            {row.byline}
                        </Text>
                        {row.basis === null ? null : (
                            <Text size="sm" weight="medium">
                                {row.basis}
                            </Text>
                        )}
                        {row.rest === null ? null : (
                            <Text size="sm" tone="muted" overflow="clamp-2">
                                {row.rest}
                            </Text>
                        )}
                    </SalesRow>
                ))}
            </SurfaceListCard>
        </>
    )
}

/** The words of a message that has any, else null. */
const textOrNull = (text: string | undefined): string | null => (text === undefined || text === "" ? null : text)

/** The focused decision requested by the connected owner. */
type SalesDecisionsProps = { readonly focusId: string | null }
type Decision = "approved" | "rejected"
/** Values and callbacks already read by the connected decision surface. */
export type SalesDecisionsControllerInput = {
    readonly props: SalesDecisionsProps
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

/** Pure vocabulary shared with the connected decision owner. */
export interface SalesDecisionVocabulary {
    readonly ageParts: typeof ageParts
    readonly decisionAnchor: typeof decisionAnchor
    readonly isStale: typeof isStale
    readonly canDecideItem: typeof canDecideItem
    readonly fieldKey: typeof fieldKey
    readonly splitBasis: typeof splitBasis
    readonly outcomeTones: typeof OUTCOME_TONES
}
/** Adds the connected owner's field-label resolver to its snapshot. */
type SalesDecisionRowInput = SalesDecisionsControllerInput & { readonly fieldLabel: (name: string) => string }

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
export const pendingSalesRow = (
    item: SalesDecision,
    input: SalesDecisionRowInput,
    vocabulary: SalesDecisionVocabulary,
): DecisionRowView => {
    const { props, t, g, me, actions, nowIso, typed, errors, active, fieldLabel } = input
    const isEditing = typed.editing[item.id] ?? false
    const age = vocabulary.ageParts(item.createdAt, nowIso)
    const amountMissing = item.missing.includes("amount_vnd")
    const isIncomplete = item.missing.some((name) => !(typed.values[vocabulary.fieldKey(item.id, name)] ?? "").trim())
    const mine = active?.id === item.id ? active.decision : null
    return {
        id: item.id,
        anchor: vocabulary.decisionAnchor(item.id),
        isFocused: props.focusId === item.id,
        badge: item.reason ? g(`reason_${item.reason}`) : t("kind_decision"),
        age: age.unit === "now" ? t("ageNow") : t(`age_${age.unit}`, { n: age.n }),
        isStale: vocabulary.isStale(item.createdAt, nowIso),
        customer: item.customer,
        leadHref: item.leadId === null ? null : leadPath(item.leadId),
        actionLabel: item.action === "follow_up" ? g("action_send_follow_up") : g(`action_${item.action}`),
        summary: item.summary,
        reasonHint: item.reason && item.reason !== "routine" ? g(`reasonHint_${item.reason}`) : null,
        amountLine: amountLineOf(item, isEditing, input.format),
        draft: item.draft && !isEditing ? item.draft : null,
        canAct: vocabulary.canDecideItem(me, item.assignedStaffId),
        assignedTo: item.assignedStaffName ? t("assignedTo", { name: item.assignedStaffName }) : null,
        missing: item.missing.map((name) => ({
            name,
            label: fieldLabel(name),
            value: typed.values[vocabulary.fieldKey(item.id, name)] ?? "",
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
export const decidedSalesRow = (
    row: FlowDecisionRow,
    input: SalesDecisionsControllerInput,
    vocabulary: SalesDecisionVocabulary,
): DecidedView => {
    const { t, g, format } = input
    const { basis, rest } = vocabulary.splitBasis(row.note)
    return {
        id: row.id,
        action: g(`action_${row.action}`),
        outcomeLabel: g(`outcome_${row.outcome}`),
        outcomeTone: vocabulary.outcomeTones[row.outcome],
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
