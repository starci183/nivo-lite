import { useMemo } from "react"
import { useMutateCancelHiringOfferSwr } from "@/hooks/swr/api/graphql/mutations/useMutateCancelHiringOfferSwr"
import { useMutateDeleteHiringCandidateSwr } from "@/hooks/swr/api/graphql/mutations/useMutateDeleteHiringCandidateSwr"
import { useMutateRescreenHiringCandidateSwr } from "@/hooks/swr/api/graphql/mutations/useMutateRescreenHiringCandidateSwr"
import { useMutateSaveHiringNotesSwr } from "@/hooks/swr/api/graphql/mutations/useMutateSaveHiringNotesSwr"

/** The commands of the candidate drawer through the back end GraphQL door. */
export const useHiringCandidateCommands = () => {
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
