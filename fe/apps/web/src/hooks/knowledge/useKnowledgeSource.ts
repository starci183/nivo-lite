"use client"

import { useMemo } from "react"
import { isNotFoundFailure } from "@/modules/failure"
import { useQueryKnowledgeSourceSwr } from "@/hooks/swr"
import { toDocumentPassage, toKnowledgeDocumentDetail } from "@/modules/documents"
import type { DocumentPassage, KnowledgeDocumentDetail } from "@/modules/types"
import { readError } from "@/hooks/workspaceread"

/** One document with its text and passages, in the shape the blocks know. */
interface KnowledgeSourceDetail {
    readonly source: KnowledgeDocumentDetail
    readonly chunks: ReadonlyArray<DocumentPassage>
}

/** One document of the active workspace by id (the back end `knowledgeSource` query). Polls while a worker is on it. */
export const useKnowledgeSource = (id: string | undefined) => {
    const swrRead = useQueryKnowledgeSourceSwr(id)
    const { data, isLoading } = swrRead
    const error = readError(swrRead)
    const detail = useMemo<KnowledgeSourceDetail | undefined>(
        () =>
            data === undefined
                ? undefined
                : {
                      source: toKnowledgeDocumentDetail(data.source),
                      chunks: data.chunks.map(toDocumentPassage),
                  },
        [data],
    )
    return { detail, error, isLoading, isMissing: error !== undefined && isNotFoundFailure(error) }
}
