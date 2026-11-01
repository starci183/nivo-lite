"use client"

import { useTranslations } from "next-intl"
import { KNOWLEDGE_STAGE_KEYS } from "@/modules/documents"
import type { KnowledgeProgressRowView, LiveProgress } from "@/modules/documents"

/**
 * The words and numbers of the processing row of a document, from what `useKnowledgeSources` gives as `live`: the title (Dang xu ly),
 * the stage a worker is on, how many passages are done, and the bar. Null when no worker is on the document.
 */
export const useKnowledgeProgressViewOf = (live: Readonly<Record<string, LiveProgress>>) => {
    const t = useTranslations("knowledge")
    return (sourceId: string): KnowledgeProgressRowView | null => {
        const state = live[sourceId]
        if (state === undefined) return null
        const counted = state.done !== null && state.total !== null && state.total > 0
        return {
            title: t("progressTitle"),
            stage: state.stage === null ? t("stage_wait") : t(KNOWLEDGE_STAGE_KEYS[state.stage]),
            count: [
                ...(counted ? [t("stageCount", { done: state.done ?? 0, total: state.total ?? 0 })] : []),
                `${Math.round(state.percent)}%`,
            ].join(" · "),
            value: state.percent,
            label: t("progressLabel"),
        }
    }
}
