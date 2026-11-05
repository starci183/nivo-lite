import type { useTranslations } from "next-intl"
import type { BrainFact, KnowledgeRowView, RowActionView, RowPartView } from "@/modules/types"
import { adviceFor, proposerOf } from "./advice"
import { reviewBoardOf } from "./board"
import type { ReviewSingle, ReviewConflict, ReviewBoard } from "./board"
import { FACT_SOURCE_KEY } from "./labels"

/** The facts review's resolved copy and initiating action identity. */
export interface ReviewRowsContext {
    readonly t: ReturnType<typeof useTranslations<"brain">>
    readonly canWrite: boolean
    readonly nowMs: number
    readonly pending: string | undefined
}

/** Source attribution is stored data combined with the catalog's own wording. */
const factByLine = (fact: BrainFact, context: ReviewRowsContext): string =>
    fact.sourceKind === "document"
        ? context.t("byDocument", { who: proposerOf(fact), trust: fact.trust })
        : context.t("by", {
              who: fact.proposedBy,
              source: context.t(FACT_SOURCE_KEY[fact.sourceKind]),
              trust: fact.trust,
          })

/** The part's available decisions carry identifiers, never closures over server data. */
const factActions = (fact: BrainFact, context: ReviewRowsContext, choose: boolean): readonly RowActionView[] =>
    context.canWrite
        ? [
              {
                  id: choose ? "choose" : "apply",
                  label: context.t("apply"),
                  intent: "neutral",
                  isPending: context.pending === `${fact.id}:${choose ? "choose" : "apply"}`,
                  isDisabled:
                      context.pending !== undefined && context.pending !== `${fact.id}:${choose ? "choose" : "apply"}`,
                  disabledReason: context.t("actionBusy"),
              },
              ...(choose
                  ? []
                  : [
                        {
                            id: "reject",
                            label: context.t("reject"),
                            intent: "neutral" as const,
                            isPending: context.pending === `${fact.id}:reject`,
                            isDisabled: context.pending !== undefined && context.pending !== `${fact.id}:reject`,
                            disabledReason: context.t("actionBusy"),
                        },
                    ]),
          ]
        : []

/** A proposed or retired value beside the value currently in force. */
const singleFactRow = (single: ReviewSingle, context: ReviewRowsContext, retire: boolean): KnowledgeRowView => {
    const t = context.t
    const advice = adviceFor(single.p, single.current, context.nowMs)
    const actions = factActions(single.p, context, false).map((action) => ({
        ...action,
        label: t(action.id === "apply" ? "retireApply" : "retireKeep"),
    }))
    const currentLines = single.current === null ? [] : [t("currentValue", { value: single.current.value })]
    const currentBadges = single.current === null ? [] : [{ label: t("conflict"), tone: "warning" as const }]
    const part: RowPartView = {
        id: single.p.id,
        title: retire ? (single.current?.value ?? single.p.value) : t("newValue", { value: single.p.value }),
        ...(retire ? {} : { value: single.p.value }),
        lines: retire
            ? [factByLine(single.p, context)]
            : [factByLine(single.p, context), `${t("suggestion")}: ${t(advice.reasonKey, advice.params)}`],
        actions: retire ? actions : factActions(single.p, context, false),
    }
    return {
        id: single.p.id,
        title: `${single.p.subjectLabel} · ${single.p.attributeLabel}`,
        ...(single.current === null ? {} : { current: single.current.value }),
        lines: retire ? [t("retireBody", { value: single.current?.value ?? single.p.value })] : currentLines,
        badges: retire ? [{ label: t("retireBadge"), tone: "warning" }] : currentBadges,
        parts: [part],
    }
}

/** Conflicting candidates remain independently decidable inside one subject row. */
const conflictFactRow = (group: ReviewConflict, context: ReviewRowsContext): KnowledgeRowView => {
    const t = context.t
    return {
        id: group.key,
        title: `${group.subjectLabel} · ${group.attributeLabel}`,
        ...(group.current === null ? {} : { current: group.current.value }),
        lines: [
            t("conflictGroupHint", { n: group.options.length }),
            ...(group.current === null ? [] : [t("currentValue", { value: group.current.value })]),
        ],
        badges: [{ label: t("conflictGroup"), tone: "warning" }],
        actions:
            !context.canWrite || group.current === null || group.options.length === 0
                ? []
                : [
                      {
                          id: "keep",
                          label: t("keepCurrentValue"),
                          intent: "alternative",
                          isPending: context.pending === `${group.key}:keep`,
                          isDisabled: context.pending !== undefined && context.pending !== `${group.key}:keep`,
                          disabledReason: t("actionBusy"),
                      },
                  ],
        parts: group.options.map((fact, index) => ({
            id: fact.id,
            title: fact.value,
            value: fact.value,
            lines: [`${t("conflictOption", { n: index + 1 })} · ${factByLine(fact, context)}`],
            actions: factActions(fact, context, true),
        })),
    }
}

type ReviewRowsOfResult = {
    plan: ReviewBoard
    rows: KnowledgeRowView[]
}

/** The resolved review rows and the current plan share one source of truth. */
export const reviewRowsOf = (facts: readonly BrainFact[], context: ReviewRowsContext): ReviewRowsOfResult => {
    const plan = reviewBoardOf(facts)
    return {
        plan,
        rows: [
            ...plan.groups.map((group) => conflictFactRow(group, context)),
            ...plan.singles.map((single) => singleFactRow(single, context, false)),
            ...plan.retires.map((single) => singleFactRow(single, context, true)),
        ],
    }
}
