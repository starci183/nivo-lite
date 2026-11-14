"use client"

import { useMemo } from "react"
import { useQueryNivoKnowledgeSwr } from "@/hooks/swr"
import { slotOfSwr } from "@/hooks/slot"
import { toNivoEntry } from "@/modules/documents"
import { readError } from "@/hooks/workspaceread"
import type { NivoEntry, DataSlot } from "@/modules/types"

/** The view `useNivoKnowledge` returns. */
export interface NivoKnowledgeView {
    items: NivoEntry[] | undefined
    error: unknown
    isLoading: boolean
    slot: DataSlot<NivoEntry[]>
    reload: () => undefined
}

/** The base knowledge of NIVO every workspace reads, in the shape the blocks know. */
export const useNivoKnowledge = (): NivoKnowledgeView => {
    const swrRead = useQueryNivoKnowledgeSwr()
    const { data, isLoading } = swrRead
    const error = readError(swrRead)
    const items = useMemo(() => (data === undefined ? undefined : data.map((entry) => toNivoEntry(entry))), [data])
    const slot = slotOfSwr({ data: items, error: swrRead.error, isLoading })
    const reload = () => void swrRead.mutate()
    return { items, error, isLoading, slot, reload }
}
