"use client"

import { useMemo } from "react"
import { useWorkspaceMember } from "@/hooks/knowledge"
import { slotOfSwr } from "@/hooks/slot"
import { useQueryPublicDocumentsSwr } from "@/hooks/swr"
import { readError } from "@/hooks/workspaceread"
import { toPublicDocument } from "@/modules/brain"
import type { PublicDocument } from "@/modules/brain"

/** No documents: one array, so a read that has not answered does not change between renders. */
const NONE: ReadonlyArray<PublicDocument> = []

/**
 * The documents written for customers, in the shape the blocks know. Owners and managers read them; nobody else asks. The list is read
 * again every few seconds while NIVO is still drafting one.
 */
export const usePublicDocuments = () => {
    const member = useWorkspaceMember()
    const swrRead = useQueryPublicDocumentsSwr(member.canWrite)
    const { data, isLoading } = swrRead
    const error = readError(swrRead)
    const documents = useMemo(() => (data === undefined ? NONE : data.map(toPublicDocument)), [data])
    const slot = slotOfSwr({ data: data === undefined ? undefined : documents, error: swrRead.error, isLoading })
    const reload = () => void swrRead.mutate()
    return { documents, error, isLoading, slot, reload, canWrite: member.canWrite }
}
