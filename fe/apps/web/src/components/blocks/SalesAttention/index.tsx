"use client"

import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { ageParts, ATTENTION_TONES, decisionHref, isStale, KNOWN_FIELDS, stageToneOf } from "@/hooks/sales"
import { navigation } from "@/modules/i18n"
import { writeFailedStep } from "@/modules/db/sales/write-sales-actions"
import { leadPath } from "@/modules/routes"
import type { AttentionRow } from "@/modules/types"
import { SalesAttentionBase } from "./component"
import type { AttentionItemView } from "./component"

/** The rows that need a person. */
interface SalesAttentionProps {
    readonly rows: ReadonlyArray<AttentionRow>
    readonly nowIso: string
}

/** What is in flight: which row, and whether it is a retry or a stop. */
interface Busy {
    readonly key: string
    readonly kind: "retry" | "stop"
}

/** The attention surface: retrying or stopping a failed step lives here, the drawing in the pure half. */
export const SalesAttention = (props: SalesAttentionProps) => {
    const t = useTranslations("workbenchSales")
    const g = useTranslations("governance")
    const router = navigation.useRouter()
    const [isPending, startTransition] = useTransition()
    const [busy, setBusy] = useState<Busy | null>(null)
    const [errors, setErrors] = useState<Readonly<Record<string, string>>>({})
    const active = isPending ? busy : null

    const fieldLabel = (name: string): string =>
        KNOWN_FIELDS.some((known) => known === name) ? g(`field_${name}`) : name
    const ageText = (since: string): string => {
        const age = ageParts(since, props.nowIso)
        return age.unit === "now" ? t("ageNow") : t(`age_${age.unit}`, { n: age.n })
    }
    const run = (kind: Busy["kind"], key: string, workItemId: string) => {
        setErrors((previous) => ({ ...previous, [key]: "" }))
        setBusy({ key, kind })
        startTransition(async () => {
            const result = await writeFailedStep({ id: workItemId, action: kind })
            if (result.kind === "ok") router.refresh()
            else
                setErrors((previous) => ({
                    ...previous,
                    [key]: t("actionFailed", { error: result.kind === "unavailable" ? result.code : result.kind }),
                }))
            setBusy(null)
        })
    }
    const needOf = (row: AttentionRow): string =>
        row.kind === "clarify" && row.missing.length > 0
            ? t("needMissing", { fields: row.missing.map(fieldLabel).join(", ") })
            : row.need
    const titleOf = (row: AttentionRow): string | null =>
        row.action && row.kind !== "overdue" && row.kind !== "awaiting_reply" ? g(`action_${row.action}`) : null
    const hrefOf = (row: AttentionRow): string | null =>
        (row.kind === "decision" || row.kind === "clarify") && row.decisionId !== null
            ? decisionHref(row.decisionId)
            : null
    const itemOf = (row: AttentionRow): AttentionItemView => ({
        key: row.key,
        kind: row.kind,
        kindLabel: t(`kind_${row.kind}`),
        kindTone: ATTENTION_TONES[row.kind],
        stage: row.stage === null ? null : { label: t(`stage_${row.stage}`), tone: stageToneOf(row.stage) },
        age: ageText(row.since),
        isStale: isStale(row.since, props.nowIso),
        customer: `${row.customer}${row.company ? ` · ${row.company}` : ""}`,
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

    return (
        <SalesAttentionBase
            props={{
                label: t("tab_attention"),
                emptyTitle: t("attentionEmptyTitle"),
                emptyBody: t("attentionEmptyBody"),
                rows: props.rows.map(itemOf),
                answerLabel: t("actionAnswer"),
                decideLabel: t("actionDecide"),
                retryLabel: t("actionRetry"),
                stopLabel: t("actionStop"),
                followUpLabel: t("actionFollowUp"),
                replyLabel: t("actionReply"),
                isBusy: active !== null,
            }}
            on={{
                retry: (key, workItemId) => run("retry", key, workItemId),
                stop: (key, workItemId) => run("stop", key, workItemId),
            }}
        />
    )
}
