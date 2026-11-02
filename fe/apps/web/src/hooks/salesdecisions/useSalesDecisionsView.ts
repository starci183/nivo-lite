"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useEffect, useState } from "react"
import { useMember } from "@/hooks/member"
import { useFeatureLifetime, useFeatureReset } from "@/hooks/reuseables"
import { useSalesDecisionForm } from "@/hooks/rhf"
import { decisionAnchor, KNOWN_FIELDS, useSalesActions } from "@/hooks/sales"
import type { SalesWorkbenchData } from "@/modules/types"
import { useGraphQLWithToast } from "@/modules/toast"
import { decidedSalesRow, editsOf, pendingSalesRow } from "./salesdecisions.shared"
import type { SalesDecisionsControllerInput } from "./salesdecisions.shared"

type Decision = "approved" | "rejected"
const FIELD_NAMES: ReadonlySet<string> = new Set(KNOWN_FIELDS)

/** Runs the same validated decision command, fencing only the local result of a retired panel. */
const createSalesDecisionsState = (input: SalesDecisionsControllerInput) => {
    const { t, g, actions, pending, decisionForm, setBusy, typed, setErrors, capture } = input
    const fieldLabel = (name: string): string => (FIELD_NAMES.has(name) ? g(`field_${name}`) : name)
    const decide = async (id: string, decision: Decision) => {
        const isCurrent = capture()
        if (!isCurrent()) return
        const item = pending.find((candidate) => candidate.id === id)
        if (item === undefined) return
        if (decision === "approved") {
            const error = decisionForm.validateDecision(item)
            if (error !== undefined) {
                setErrors((previous) => ({ ...previous, [id]: error }))
                return
            }
            const valid = await decisionForm.validateForm(item)
            if (!isCurrent()) return
            if (!valid) {
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
        if (!isCurrent()) return
        if (result !== undefined) decisionForm.finish(id)
        else {
            setErrors((previous) => ({ ...previous, [id]: t("loadFailedBody") }))
            setBusy(null)
        }
    }
    return { ...input, fieldLabel, decide }
}

/** Owns the real pending-decision editor and historical display within its original tab lifetime. */
export const useSalesDecisionsView = (
    data: SalesWorkbenchData | null,
    isActive: boolean,
    scope: string,
    focusId: string | null,
) => {
    const t = useTranslations("workbenchSales")
    const g = useTranslations("governance")
    const format = useFormatter()
    const me = useMember()
    const actions = useSalesActions({ isActive, scope })
    const runGraphQL = useGraphQLWithToast()
    const lifetime = useFeatureLifetime(isActive, scope)
    const pending = data?.decisions ?? []
    const decided = data?.decided ?? []
    const decisionForm = useSalesDecisionForm()
    const [busy, setBusy] = useState<{ readonly id: string; readonly decision: Decision } | null>(null)
    const [errors, setErrors] = useState<Readonly<Record<string, string>>>({})
    useFeatureReset({
        isActive,
        isReady: true,
        scope,
        onReset: () => {
            decisionForm.reset()
            setBusy(null)
            setErrors({})
        },
    })
    useEffect(() => {
        if (!isActive || focusId === null) return
        document.getElementById(decisionAnchor(focusId))?.scrollIntoView({ block: "center", behavior: "smooth" })
    }, [focusId, isActive, scope])
    const context = createSalesDecisionsState({
        props: { focusId },
        t,
        g,
        format,
        me,
        actions,
        data,
        nowIso: data?.nowIso ?? new Date(0).toISOString(),
        pending,
        decided,
        decisionForm,
        busy,
        setBusy,
        typed: decisionForm.typed,
        errors,
        setErrors,
        active: actions.isMutating ? busy : null,
        capture: lifetime.capture,
    })
    return {
        props: {
            pendingLabel: t("pendingTitle"),
            emptyTitle: t("decisionsEmptyTitle"),
            emptyBody: t("decisionsEmptyBody"),
            decidedTitle: t("decidedTitle"),
            decidedBody: t("decidedBody"),
            decidedEmptyTitle: t("decidedEmptyTitle"),
            decidedEmptyBody: t("decidedEmptyBody"),
            pending: pending.map((item) => pendingSalesRow(item, context)),
            decided: decided.map((row) => decidedSalesRow(row, context)),
            rowLabels: {
                draftLabel: t("draftLabel"),
                waitingManager: t("waitingManager"),
                amountLabel: g("field_amount_vnd"),
                approveLabel: t("approve"),
                rejectLabel: t("reject"),
            },
        },
        on: {
            field: decisionForm.field,
            draft: decisionForm.draft,
            amount: decisionForm.amount,
            toggleEdit: decisionForm.toggleEdit,
            decide: (id: string, decision: Decision) => {
                context
                    .decide(id, decision)
                    .catch((error: unknown) => runGraphQL(() => Promise.reject(error), { showSuccessToast: false }))
            },
        },
    }
}
