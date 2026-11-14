"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useMemo } from "react"
import { useQueryAgentRunAiCallsSwr } from "@/hooks/swr"
import { aiCallRowsOf, type AiCallRowView } from "@/modules/agentRuns"

/** The tag of a call kind (`<node id>:<tag>`), or the whole kind when it has none. */
const tagOf = (purpose: string): string => purpose.slice(purpose.lastIndexOf(":") + 1)

/** The node id of a call kind (`<node id>:<tag>`), or the whole kind when it has no tag. */
const nodeOf = (purpose: string): string => (purpose.includes(":") ? purpose.slice(0, purpose.lastIndexOf(":")) : purpose)

/**
 * The AI calls of one run as table rows, read apart from the page's own read. A call kind is named by its words when the app has
 * them, else by the label the back end sent, else by the run's step it belongs to (`stepLabels`, node key → title), else by its bare tag; never the raw kind. Empty while it is read, when it failed (a back end
 * without `aiCalls`) or when the run called no AI: the page then leaves the section out.
 */
export const useAgentRunAiCalls = (
    installationId: string,
    runId: string,
    stepLabels: ReadonlyMap<string, string>,
): ReadonlyArray<AiCallRowView> => {
    const t = useTranslations("agentRuns")
    const format = useFormatter()
    const read = useQueryAgentRunAiCallsSwr({ installationId, runId })
    const calls = read.error === undefined ? read.data : undefined
    return useMemo(
        () =>
            aiCallRowsOf(calls ?? [], {
                count: (value) => format.number(value),
                decimal: (value) => format.number(value, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
                usd: (value) =>
                    format.number(value, {
                        style: "currency",
                        currency: "USD",
                        minimumFractionDigits: 4,
                        maximumFractionDigits: 4,
                    }),
                purposeOf: (purpose, label) => {
                    const key = `aiPurpose_${tagOf(purpose)}`
                    if (t.has(key)) return t(key)
                    if (label !== null && label !== "") return label
                    return stepLabels.get(tagOf(purpose)) ?? stepLabels.get(nodeOf(purpose)) ?? tagOf(purpose)
                },
                maxTry: (count) => t("aiMaxTry", { count }),
                cached: (count) => t("aiCached", { count }),
                reasoning: (count) => t("aiReasoning", { count }),
                seconds: (value) => t("aiSeconds", { value }),
                slowest: (value) => t("aiSlowest", { value }),
                finish: (reasons) => t("aiFinish", { reasons }),
            }),
        [calls, format, stepLabels, t],
    )
}
