"use client"

import { useTranslations } from "next-intl"
import { useKnowledgeSources } from "@/hooks/knowledge"
import type { QueuedDoc } from "@/hooks/knowledge"
import type { AddProgressView } from "@/modules/documents"
import { useKnowledgeRowOf } from "./useKnowledgeRowOf"

/**
 * The progress of the documents an add drawer queued: for each, its stage with the count and the bar while a worker reads it, then
 * what it learnt or the plain reason it failed with the retry. A document the list does not hold yet waits under its own name.
 */
export const useAddProgress = (docs: ReadonlyArray<QueuedDoc>): AddProgressView => {
    const t = useTranslations("knowledge")
    const { sources, live } = useKnowledgeSources()
    const { rowOf, commands } = useKnowledgeRowOf(live)
    return {
        title: t("addProgressTitle"),
        isPending: commands.retrying.size > 0,
        rows: docs.map((doc) => {
            const source = sources?.find((one) => one.id === doc.id)
            return source === undefined
                ? {
                      id: doc.id,
                      title: doc.title,
                      lines: [],
                      badges: [{ label: t("stage_wait"), tone: "neutral" as const }],
                      actions: [],
                      progress: undefined,
                  }
                : rowOf(source)
        }),
    }
}
