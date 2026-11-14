"use client"

import { useMemo } from "react"
import { useWorkspaceMember } from "@/hooks/knowledge"
import { slotOfSwr } from "@/hooks/slot"
import { useQueryPublicDocumentsSwr } from "@/hooks/swr"
import { readError } from "@/hooks/workspaceread"
import { toPublicDocument, type PublicDocument } from "@/modules/brain"
import type { DataSlot } from "@/modules/types"

/** No documents: one array, so a read that has not answered does not change between renders. */
const NONE: ReadonlyArray<PublicDocument> = []

/** The view `usePublicDocuments` returns. */
export interface PublicDocumentsView {
    documents: readonly PublicDocument[]
    error: unknown
    isLoading: boolean
    slot: DataSlot<readonly PublicDocument[]>
    reload: () => undefined
    canWrite: boolean
}

/**
 * The documents written for customers, in the shape the blocks know. Owners and managers read them; nobody else asks. The list is read
 * again every few seconds while NIVO is still drafting one.
 */
export const usePublicDocuments = (): PublicDocumentsView => {
    const member = useWorkspaceMember()
    const swrRead = useQueryPublicDocumentsSwr(member.canWrite)
    const { data, isLoading } = swrRead
    const error = readError(swrRead)
    const documents = useMemo(() => (data === undefined ? NONE : data.map((entry) => toPublicDocument(entry))), [data])
    const slot = slotOfSwr({ data: data === undefined ? undefined : documents, error: swrRead.error, isLoading })
    const reload = () => void swrRead.mutate()
    return { documents, error, isLoading, slot, reload, canWrite: member.canWrite }
}
