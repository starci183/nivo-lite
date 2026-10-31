"use client"

import useSWRMutation from "swr/mutation"
import { mutateApproveDossierRemedyDraft } from "@/modules/api/graphql/mutations/mutation-approve-dossier-remedy-draft"
import type { MutateApproveDossierRemedyDraftRequest } from "@/modules/api/graphql/mutations/mutation-approve-dossier-remedy-draft"

/** What the ApproveDossierRemedyDraft mutation is triggered with. */
interface ApproveDossierRemedyDraftArg {
    readonly arg: MutateApproveDossierRemedyDraftRequest
}

/** The SWR key of the approveDossierRemedyDraft mutation. */
export const MUTATE_APPROVE_DOSSIER_REMEDY_DRAFT_SWR_KEY = "MUTATE_APPROVE_DOSSIER_REMEDY_DRAFT_SWR"

/** SWR mutation for {@link mutateApproveDossierRemedyDraft}: approves a proposed draft: it becomes a document of the dossier and the finding is resolved. `trigger(input)` rejects with the back end failure. */
export const useMutateApproveDossierRemedyDraftSwr = () =>
    useSWRMutation(
        MUTATE_APPROVE_DOSSIER_REMEDY_DRAFT_SWR_KEY,
        async (_key: string, { arg }: ApproveDossierRemedyDraftArg) => {
            const result = await mutateApproveDossierRemedyDraft({ request: arg })
            if (!result.data) throw new Error("approveDossierRemedyDraft answered no data")
            return result.data.approveDossierRemedyDraft
        },
    )
