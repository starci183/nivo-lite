"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useEffect, useState } from "react"
import { useMember } from "@/hooks/member"
import { useFeatureLifetime, useFeatureReset } from "@/hooks/reuseables"
import { useSalesDecisionForm } from "@/hooks/rhf"
import { decisionAnchor, KNOWN_FIELDS, useSalesActions } from "@/hooks/sales"
import type { SalesWorkbenchData } from "@/modules/types"
import type { BadgeTone } from "@starci/grammar/common"
import { decidedSalesRow, pendingSalesRow } from "./salesdecisions.shared"
import type { SalesDecisionsControllerInput } from "./salesdecisions.shared"
import { useSalesDecide, type Decision } from "./useSalesDecide"

const FIELD_NAMES: ReadonlySet<string> = new Set(KNOWN_FIELDS)

/** One pending decision as the list draws it. */
export type PendingSalesRowResult = {
    id: string
    anchor: string
    isFocused: boolean
    badge: string
    age: string
    isStale: boolean
    customer: string
    leadHref: string | null
    actionLabel: string
    summary: string
    reasonHint: string | null
    amountLine: string | null
    draft: string | null
    canAct: boolean
    assignedTo: string | null
    missing: {
        name: string
        label: string
        value: string
    }[]
    isEditing: boolean
    draftValue: string
    showDraftField: boolean
    amountValue: string
    showAmountField: boolean
    canEdit: boolean
    isBusy: boolean
    isApproveBusy: boolean
    isRejectBusy: boolean
    isApproveDisabled: boolean
    editLabel: string
    error: string | null
}

/** One completed decision and its attribution. */
export type DecidedSalesRowResult = {
    id: string
    action: string
    outcomeLabel: string
    outcomeTone: BadgeTone
    customer: string
    href: string | null
    byline: string
    basis: string | null
    rest: string | null
}

type UseSalesDecisionsViewResult = {
    props: {
        pendingLabel: string
        emptyTitle: string
        emptyBody: string
        decidedTitle: string
        decidedBody: string
        decidedEmptyTitle: string
        decidedEmptyBody: string
        pending: PendingSalesRowResult[]
        decided: DecidedSalesRowResult[]
        rowLabels: {
            draftLabel: string
            waitingManager: string
            amountLabel: string
            approveLabel: string
            rejectLabel: string
        }
    }
    on: {
        field: (id: string, name: string, value: string) => void
        draft: (id: string, value: string) => void
        amount: (id: string, value: string) => void
        toggleEdit: (id: string) => void
        decide: (id: string, decision: Decision) => void
    }
}

/** Owns the real pending-decision editor and historical display within its original tab lifetime. */
export const useSalesDecisionsView = (
    data: SalesWorkbenchData | null,
    isActive: boolean,
    scope: string,
    focusId: string | null,
): UseSalesDecisionsViewResult => {
    const t = useTranslations("workbenchSales")
    const g = useTranslations("governance")
    const format = useFormatter()
    const me = useMember()
    const actions = useSalesActions({ isActive, scope })
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
    const state: SalesDecisionsControllerInput = {
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
    }
    const decide = useSalesDecide(state)
    const fieldLabel = (name: string): string => (FIELD_NAMES.has(name) ? g(`field_${name}`) : name)
    const context = { ...state, fieldLabel }
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
            decide,
        },
    }
}
