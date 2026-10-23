"use client"

import { useMemo } from "react"
import { useQueryNivoKnowledgeSwr } from "@/hooks/swr"
import { toNivoEntry } from "@/modules/documents"
import { readError } from "@/hooks/workspaceread"

/** The base knowledge of NIVO every workspace reads, in the shape the blocks know. */
export const useNivoKnowledge = () => {
    const swrRead = useQueryNivoKnowledgeSwr()
    const { data, isLoading } = swrRead
    const error = readError(swrRead)
    const items = useMemo(() => (data === undefined ? undefined : data.map(toNivoEntry)), [data])
    return { items, error, isLoading }
}
