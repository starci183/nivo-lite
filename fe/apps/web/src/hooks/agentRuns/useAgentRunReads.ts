"use client"

import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { slotOfReads } from "@/hooks/slot"
import { useQueryAgentRunSwr, useQueryBrainSwr } from "@/hooks/swr"
import { readRowsOf, type ReadRowView } from "@/modules/agentRuns"
import type { DataSlot } from "@/modules/types"

/**
 * The truths one run read, one row per truth, named and valued from the shop's brain. The run read is the page's own (same key, so
 * the page's poll keeps it fresh); the brain read is the shared one. Rows are empty when the run read nothing (or ran before the
 * back end recorded reads): the page then leaves the card out.
 */
export const useAgentRunReads = (installationId: string, runId: string): DataSlot<ReadonlyArray<ReadRowView>> => {
    const t = useTranslations("agentRunReads")
    const run = useQueryAgentRunSwr({ installationId, runId })
    const brain = useQueryBrainSwr()
    const reads = run.data?.truthReads
    const facts = brain.data?.facts
    const rows = useMemo(() => {
        if (reads === undefined) return undefined
        if (reads.length === 0) return []
        if (facts === undefined) return undefined
        return readRowsOf(reads, facts, {
            title: (subject, attribute) => t("factTitle", { subject, attribute }),
            subtitle: (version, source, count) =>
                [
                    version === null ? t("factKind") : t("factKindVersion", { version }),
                    source,
                    ...(count > 1 ? [t("readTimes", { count })] : []),
                ].join(" · "),
            source: (kind) => (t.has(`source_${kind}`) ? t(`source_${kind}`) : t("source_ai")),
            gone: (version) => (version === null ? t("gone") : t("goneVersion", { version })),
            goneSubtitle: (count) => (count > 1 ? t("readTimes", { count }) : ""),
        })
    }, [reads, facts, t])
    return slotOfReads([run, ...(reads?.length === 0 ? [] : [brain])], () => rows)
}
