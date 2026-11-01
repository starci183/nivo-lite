"use client"

import { useTranslations } from "next-intl"
import { INGEST_STAGES, ingestStageOf, isDocumentActive, useKnowledgeSources } from "@/hooks/knowledge"
import { KnowledgeProcessingBase } from "./component"
import type { ProcessingRowView } from "./component"

/** The connected list of documents being taken in: the four stages of each, live while a worker is on it. Nothing is drawn when no document is being taken in. */
export const KnowledgeProcessing = () => {
    const t = useTranslations("knowledge")
    const { sources, live } = useKnowledgeSources()
    const rows = (sources ?? []).flatMap((source): ReadonlyArray<ProcessingRowView> => {
        const stage = ingestStageOf(source.status)
        if (stage === null || !isDocumentActive(source.status)) return []
        return [
            {
                id: source.id,
                title: source.title,
                percentLabel: `${Math.round(live[source.id]?.percent ?? source.progress)}%`,
                stageId: stage,
            },
        ]
    })
    if (rows.length === 0) return null
    return (
        <KnowledgeProcessingBase
            props={{
                title: t("processingTitle"),
                stepsLabel: t("processingSteps"),
                steps: INGEST_STAGES.map((stage) => ({ id: stage, label: t(`ingest_${stage}`) })),
                rows,
            }}
        />
    )
}
