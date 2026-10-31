"use client"

import { slotOfSwr } from "@/hooks/slot"
import { useQueryDossierRemedyDraftSwr } from "@/hooks/swr"
import { draftViewOf } from "@/modules/brain"
import type { DraftView } from "@/modules/brain"
import type { DataSlot } from "@/modules/types"

/** What one remedy draft gives the drawer that shows it. */
interface DossierRemedyDraft {
    readonly slot: DataSlot<DraftView>
    /** NIVO is still writing it: the draft is read again every few seconds meanwhile. */
    readonly isGenerating: boolean
    readonly reload: () => void
}

/** The remedy draft with the given id, read again while NIVO writes it; nothing is read while no draft is open. */
export const useDossierRemedyDraft = (draftId: string | undefined): DossierRemedyDraft => {
    const read = useQueryDossierRemedyDraftSwr(draftId)
    const record = read.data
    const view = record === null || record === undefined ? undefined : draftViewOf(record)
    return {
        slot: slotOfSwr({ data: view, error: read.error, isLoading: read.isLoading }),
        isGenerating: view?.status === "generating",
        reload: () => void read.mutate(),
    }
}
