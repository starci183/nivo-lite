"use client"

import useSWRMutation from "swr/mutation"
import { mutateSaveDossierRemedyDraft } from "@/modules/api/graphql/mutations/mutation-save-dossier-remedy-draft"
import type { MutateSaveDossierRemedyDraftRequest } from "@/modules/api/graphql/mutations/mutation-save-dossier-remedy-draft"

/** What the SaveDossierRemedyDraft mutation is triggered with. */
interface SaveDossierRemedyDraftArg {
    readonly arg: MutateSaveDossierRemedyDraftRequest
}

/** The SWR key of the saveDossierRemedyDraft mutation. */
export const MUTATE_SAVE_DOSSIER_REMEDY_DRAFT_SWR_KEY = "MUTATE_SAVE_DOSSIER_REMEDY_DRAFT_SWR"

/** SWR mutation for {@link mutateSaveDossierRemedyDraft}: saves the owner's edits of the title and body of a proposed draft. `trigger(input)` rejects with the back end failure. */
export const useMutateSaveDossierRemedyDraftSwr = () =>
    useSWRMutation(
        MUTATE_SAVE_DOSSIER_REMEDY_DRAFT_SWR_KEY,
        async (_key: string, { arg }: SaveDossierRemedyDraftArg) => {
            const result = await mutateSaveDossierRemedyDraft({ request: arg })
            if (!result.data) throw new Error("saveDossierRemedyDraft answered no data")
            return result.data.saveDossierRemedyDraft
        },
    )
