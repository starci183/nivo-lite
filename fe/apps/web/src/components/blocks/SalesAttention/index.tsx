"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import {
    ageParts,
    ATTENTION_TONES,
    decisionHref,
    isStale,
    KNOWN_FIELDS,
    stageToneOf,
    useSalesActions,
} from "@/hooks/sales"
import { useSalesWorkbench } from "@/hooks/salesworkbench"
import { leadPath } from "@/modules/routes"
import type { AttentionRow } from "@/modules/types"
import { SalesAttentionBase } from "./component"
import type { AttentionItemView } from "./component"

/** What is in flight: which row, and whether it is a retry or a stop. */
interface Busy {
    readonly key: string
    readonly kind: "retry" | "stop"
}

/** Resolves navigation and customer identity for an attention row. */
const FIELD_NAMES: ReadonlySet<string> = new Set(KNOWN_FIELDS)

const hrefOf = (row: AttentionRow): string | null =>
    (row.kind === "decision" || row.kind === "clarify") && row.decisionId !== null ? decisionHref(row.decisionId) : null
const customerOf = (row: AttentionRow): string => {
    const company = row.company ? ` · ${row.company}` : ""
    return `${row.customer}${company}`
}

/** The attention surface: retrying or stopping a failed step lives here, the drawing in the pure half. */
export const SalesAttention = () => {
    const t = useTranslations("workbenchSales")
    const g = useTranslations("governance")
    const actions = useSalesActions()
    const { data, nowIso } = useSalesWorkbench()
    const [busy, setBusy] = useState<Busy | null>(null)
    const [errors, setErrors] = useState<Readonly<Record<string, string>>>({})
    const active = actions.isMutating ? busy : null

    const fieldLabel = (name: string): string => {
        return FIELD_NAMES.has(name) ? g(`field_${name}`) : name
    }
    const ageText = (since: string): string => {
        const age = ageParts(since, nowIso)
        return age.unit === "now" ? t("ageNow") : t(`age_${age.unit}`, { n: age.n })
    }
    const run = async (kind: Busy["kind"], key: string, workItemId: string) => {
        setErrors((previous) => ({ ...previous, [key]: "" }))
        setBusy({ key, kind })
        const result =
            kind === "retry"
                ? await actions.retryFailedStep({ id: workItemId })
                : await actions.stopFailedStep({ id: workItemId })
        if (result === undefined) {
            setErrors((previous) => ({ ...previous, [key]: t("loadFailedBody") }))
            setBusy(null)
        }
    }
    const needOf = (row: AttentionRow): string =>
        row.kind === "clarify" && row.missing.length > 0
            ? t("needMissing", { fields: row.missing.map(fieldLabel).join(", ") })
            : row.need
    const titleOf = (row: AttentionRow): string | null =>
        row.action && row.kind !== "overdue" && row.kind !== "awaiting_reply" ? g(`action_${row.action}`) : null
    const itemOf = (row: AttentionRow): AttentionItemView => ({
        key: row.key,
        kind: row.kind,
        kindLabel: t(`kind_${row.kind}`),
        kindTone: ATTENTION_TONES[row.kind],
        stage: row.stage === null ? null : { label: t(`stage_${row.stage}`), tone: stageToneOf(row.stage) },
        age: ageText(row.since),
        isStale: isStale(row.since, nowIso),
        customer: customerOf(row),
        leadHref: row.leadId === null ? null : leadPath(row.leadId),
        title: titleOf(row),
        need: needOf(row),
        owner: row.owner ? t("owner", { name: row.owner }) : t("ownerNone"),
        decisionHref: hrefOf(row),
        workItemId: row.workItemId,
        error: errors[row.key] ? errors[row.key] : null,
        isRetryBusy: active?.key === row.key && active.kind === "retry",
        isStopBusy: active?.key === row.key && active.kind === "stop",
    })

    if (data === null) return null
    return (
        <SalesAttentionBase
            props={{
                label: t("tab_attention"),
                emptyTitle: t("attentionEmptyTitle"),
                emptyBody: t("attentionEmptyBody"),
                rows: (data?.attention ?? []).map(itemOf),
                answerLabel: t("actionAnswer"),
                decideLabel: t("actionDecide"),
                retryLabel: t("actionRetry"),
                stopLabel: t("actionStop"),
                followUpLabel: t("actionFollowUp"),
                replyLabel: t("actionReply"),
                isBusy: actions.isMutating,
            }}
            on={{
                retry: (key, workItemId) => run("retry", key, workItemId),
                stop: (key, workItemId) => run("stop", key, workItemId),
            }}
        />
    )
}
