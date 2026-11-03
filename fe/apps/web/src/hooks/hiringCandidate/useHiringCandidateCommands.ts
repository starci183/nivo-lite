"use client"

import { useMemo } from "react"
import {
    useMutateCancelHiringOfferSwr,
    useMutateDeleteHiringCandidateSwr,
    useMutateRescreenHiringCandidateSwr,
    useMutateSaveHiringNotesSwr,
} from "@/hooks/swr"

/** The view `useHiringCandidateCommands` returns. */
export interface HiringCandidateCommandsView {
    rescreen: (id: string) => Promise<{
        error: string | null
        status: string
        summary: string
    }>
    saveNotes: (id: string, notes: string) => Promise<boolean>
    cancelOffer: (id: string) => Promise<boolean>
    remove: (id: string) => Promise<{
        files: number
    }>
}

/** The commands of the candidate drawer through the back end GraphQL door. */
export const useHiringCandidateCommands = (): HiringCandidateCommandsView => {
    const { trigger: rescreenTrigger } = useMutateRescreenHiringCandidateSwr()
    const { trigger: notesTrigger } = useMutateSaveHiringNotesSwr()
    const { trigger: cancelTrigger } = useMutateCancelHiringOfferSwr()
    const { trigger: deleteTrigger } = useMutateDeleteHiringCandidateSwr()
    return useMemo(
        () => ({
            rescreen: (id: string) => rescreenTrigger({ id }),
            saveNotes: (id: string, notes: string) => notesTrigger({ id, notes }),
            cancelOffer: (id: string) => cancelTrigger({ id }),
            remove: (id: string) => deleteTrigger({ id }),
        }),
        [rescreenTrigger, notesTrigger, cancelTrigger, deleteTrigger],
    )
}
