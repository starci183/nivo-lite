"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useEffect, useState } from "react"
import { splitBasis } from "@/hooks/decisions"
import { canDecideItem, useMember } from "@/hooks/member"
import { useSalesDecisionForm } from "@/hooks/rhf"
import { ageParts, decisionAnchor, isStale, KNOWN_FIELDS, OUTCOME_TONES, useSalesActions } from "@/hooks/sales"
import { editsOf, fieldKey } from "@/hooks/salesdecisions"
import { useSalesWorkbench } from "@/hooks/salesworkbench"

import { SalesDecisionsBase, pendingSalesRow, decidedSalesRow } from "./component"
import type { SalesDecisionsControllerInput, SalesDecisionVocabulary } from "./component"

/** The decision to highlight. */
interface SalesDecisionsProps {
    /** The decision to scroll to and highlight (set when opened from the Attention surface). */
    readonly focusId: string | null
}

type Decision = "approved" | "rejected"

const decisionVocabulary: SalesDecisionVocabulary = {
    ageParts,
    decisionAnchor,
    isStale,
    canDecideItem,
    fieldKey,
    splitBasis,
    outcomeTones: OUTCOME_TONES,
}

/** The decisions surface: the typed values, the edit toggles and the decisions themselves live here, the drawing in the pure half. */
const createSalesDecisionsState = (input: SalesDecisionsControllerInput) => {
    const { t, g, actions, pending, decisionForm, setBusy, typed, setErrors } = input

    const fieldLabel = (name: string): string => {
        return KNOWN_FIELDS.some((field) => field === name) ? g(`field_${name}`) : name
    }
    const decide = async (id: string, decision: Decision) => {
        const item = pending.find((candidate) => candidate.id === id)
        if (item === undefined) return
        if (decision === "approved") {
            const error = decisionForm.validateDecision(item)
            if (error !== undefined) {
                setErrors((previous) => ({ ...previous, [id]: error }))
                return
            }
            if (!(await decisionForm.validateForm(item))) {
                setErrors((previous) => ({ ...previous, [id]: t("salesDecisionInvalid") }))
                return
            }
        }
        setErrors((previous) => ({ ...previous, [id]: "" }))
        setBusy({ id, decision })
        const draft = (typed.drafts[id] ?? item.draft).trim()
        const edited = decision === "approved" && typed.editing[id] && draft !== item.draft ? draft : undefined
        const result =
            item.source === "execution" && item.executionId
                ? await actions.decideDraft({ id: item.executionId, decision, editedDraft: edited })
                : await actions.decideWorkItem({
                      id: item.id,
                      decision,
                      edits: decision === "approved" ? editsOf(item, typed) : undefined,
                  })
        if (result !== undefined) decisionForm.finish(id)
        else {
            setErrors((previous) => ({
                ...previous,
                [id]: t("loadFailedBody"),
            }))
            setBusy(null)
        }
    }
    return { ...input, fieldLabel, decide }
}

/** Shows pending decisions and the completed decision history. */
export const SalesDecisions = (props: SalesDecisionsProps) => {
    const t = useTranslations("workbenchSales")
    const g = useTranslations("governance")
    const format = useFormatter()
    const me = useMember()
    const actions = useSalesActions()
    const { data, nowIso } = useSalesWorkbench()
    const pending = data?.decisions ?? []
    const decided = data?.decided ?? []
    const decisionForm = useSalesDecisionForm()
    const [busy, setBusy] = useState<{ readonly id: string; readonly decision: Decision } | null>(null)
    const { typed } = decisionForm
    const [errors, setErrors] = useState<Readonly<Record<string, string>>>({})
    const active = actions.isMutating ? busy : null

    useEffect(() => {
        if (props.focusId === null) return
        document.getElementById(decisionAnchor(props.focusId))?.scrollIntoView({ block: "center", behavior: "smooth" })
    }, [props.focusId])
    const context = createSalesDecisionsState({
        props,
        t,
        g,
        format,
        me,
        actions,
        data,
        nowIso,
        pending,
        decided,
        decisionForm,
        busy,
        setBusy,
        typed,
        errors,
        setErrors,
        active,
    })

    if (data === null) return null
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
                pending: pending.map((item) => pendingSalesRow(item, context, decisionVocabulary)),
                decided: decided.map((row) => decidedSalesRow(row, context, decisionVocabulary)),
                rowLabels: {
                    draftLabel: t("draftLabel"),
                    waitingManager: t("waitingManager"),
                    amountLabel: g("field_amount_vnd"),
                    approveLabel: t("approve"),
                    rejectLabel: t("reject"),
                },
            }}
            on={{
                field: decisionForm.field,
                draft: decisionForm.draft,
                amount: decisionForm.amount,
                toggleEdit: decisionForm.toggleEdit,
                decide: context.decide,
            }}
        />
    )
}
