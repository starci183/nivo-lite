"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useFeatureLifetime, useFeatureReset } from "@/hooks/reuseables"
import { stageWordOf } from "@/hooks/salesworkbench"
import { leadPath } from "@/modules/routes"
import type { AttentionItemView, AttentionRow, SalesWorkbenchData } from "@/modules/types"
import { actionWordOf } from "@/hooks/actionWord"
import { useGraphQLWithToast } from "@/modules/toast"
import { ageParts, ATTENTION_TONES, decisionHref, isStale, KNOWN_FIELDS, stageToneOf } from "./sales.shared"
import { useSalesActions } from "./useSalesActions"

interface Busy {
    readonly key: string
    readonly kind: "retry" | "stop"
}
const FIELD_NAMES: ReadonlySet<string> = new Set(KNOWN_FIELDS)

/** Owns the former Attention mount's retry/stop state and resolves its existing row facts. */
export const useSalesAttentionView = (data: SalesWorkbenchData | null, isActive: boolean, scope: string) => {
    const t = useTranslations("workbenchSales")
    const g = useTranslations("governance")
    const actions = useSalesActions({ isActive, scope })
    const runGraphQL = useGraphQLWithToast()
    const lifetime = useFeatureLifetime(isActive, scope)
    const [busy, setBusy] = useState<Busy | null>(null)
    const [errors, setErrors] = useState<Readonly<Record<string, string>>>({})
    useFeatureReset({
        isActive,
        isReady: true,
        scope,
        onReset: () => {
            setBusy(null)
            setErrors({})
        },
    })
    const run = async (kind: Busy["kind"], key: string, workItemId: string) => {
        const isCurrent = lifetime.capture()
        if (!isCurrent()) return
        setErrors((previous) => ({ ...previous, [key]: "" }))
        setBusy({ key, kind })
        const result =
            kind === "retry"
                ? await actions.retryFailedStep({ id: workItemId })
                : await actions.stopFailedStep({ id: workItemId })
        if (result === undefined && isCurrent()) {
            setErrors((previous) => ({ ...previous, [key]: t("loadFailedBody") }))
            setBusy(null)
        }
    }
    return {
        props: {
            label: t("tab_attention"),
            emptyTitle: t("attentionEmptyTitle"),
            emptyBody: t("attentionEmptyBody"),
            rows: attentionItemsOf({ t, g, data, errors, active: actions.isMutating ? busy : null }),
            answerLabel: t("actionAnswer"),
            decideLabel: t("actionDecide"),
            retryLabel: t("actionRetry"),
            stopLabel: t("actionStop"),
            followUpLabel: t("actionFollowUp"),
            replyLabel: t("actionReply"),
            isBusy: actions.isMutating,
        },
        on: {
            retry: (key: string, workItemId: string) => {
                run("retry", key, workItemId).catch((error: unknown) =>
                    runGraphQL(() => Promise.reject(error), { showSuccessToast: false }),
                )
            },
            stop: (key: string, workItemId: string) => {
                run("stop", key, workItemId).catch((error: unknown) =>
                    runGraphQL(() => Promise.reject(error), { showSuccessToast: false }),
                )
            },
        },
    }
}

interface AttentionItemsInput {
    readonly t: ReturnType<typeof useTranslations<"workbenchSales">>
    readonly g: ReturnType<typeof useTranslations<"governance">>
    readonly data: SalesWorkbenchData | null
    readonly errors: Readonly<Record<string, string>>
    readonly active: Busy | null
}

/** The same navigation, customer, elapsed-time and permission-independent display facts of each attention row. */
const attentionItemsOf = ({ t, g, data, errors, active }: AttentionItemsInput): ReadonlyArray<AttentionItemView> => {
    const nowIso = data?.nowIso ?? new Date(0).toISOString()
    const fieldLabel = (name: string) => (FIELD_NAMES.has(name) ? g(`field_${name}`) : name)
    const ageText = (since: string) => {
        const age = ageParts(since, nowIso)
        return age.unit === "now" ? t("ageNow") : t(`age_${age.unit}`, { n: age.n })
    }
    const needOf = (row: AttentionRow) =>
        row.kind === "clarify" && row.missing.length > 0
            ? t("needMissing", { fields: row.missing.map(fieldLabel).join(", ") })
            : row.need
    return (data?.attention ?? []).map((row) => ({
        key: row.key,
        kind: row.kind,
        kindLabel: t(`kind_${row.kind}`),
        kindTone: ATTENTION_TONES[row.kind],
        stage: row.stage === null ? null : { label: stageWordOf(t, row.stage), tone: stageToneOf(row.stage) },
        age: ageText(row.since),
        isStale: isStale(row.since, nowIso),
        customer: row.customer + (row.company ? " · " + row.company : ""),
        leadHref: row.leadId === null ? null : leadPath(row.leadId),
        title:
            row.action && row.kind !== "overdue" && row.kind !== "awaiting_reply" ? actionWordOf(g, row.action) : null,
        need: needOf(row),
        owner: row.owner ? t("owner", { name: row.owner }) : t("ownerNone"),
        decisionHref:
            (row.kind === "decision" || row.kind === "clarify") && row.decisionId !== null
                ? decisionHref(row.decisionId)
                : null,
        workItemId: row.workItemId,
        error: errors[row.key] || null,
        isRetryBusy: active?.key === row.key && active.kind === "retry",
        isStopBusy: active?.key === row.key && active.kind === "stop",
    }))
}
