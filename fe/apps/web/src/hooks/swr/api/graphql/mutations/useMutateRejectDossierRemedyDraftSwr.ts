"use client"

import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import {
    mutateRejectDossierRemedyDraft,
    type MutateRejectDossierRemedyDraftRequest,
} from "@/modules/api/graphql/mutations/mutation-reject-dossier-remedy-draft"
import type { RejectDossierRemedyDraftMutation } from "@/modules/api"

/** What the RejectDossierRemedyDraft mutation is triggered with. */
interface RejectDossierRemedyDraftArg {
    readonly arg: MutateRejectDossierRemedyDraftRequest
}

/** The SWR key of the rejectDossierRemedyDraft mutation. */
export const MUTATE_REJECT_DOSSIER_REMEDY_DRAFT_SWR_KEY = "MUTATE_REJECT_DOSSIER_REMEDY_DRAFT_SWR"

/** SWR mutation for {@link mutateRejectDossierRemedyDraft}: rejects a proposed draft, with an optional reason; the finding stays as it was. `trigger(input)` rejects with the back end failure. */
export const useMutateRejectDossierRemedyDraftSwr = (): SWRMutationResponse<
    RejectDossierRemedyDraftMutation["rejectDossierRemedyDraft"],
    Error,
    typeof MUTATE_REJECT_DOSSIER_REMEDY_DRAFT_SWR_KEY,
    RejectDossierRemedyDraftArg["arg"]
> =>
    useSWRMutation(
        MUTATE_REJECT_DOSSIER_REMEDY_DRAFT_SWR_KEY,
        async (_key: string, { arg }: RejectDossierRemedyDraftArg) => {
            const result = await mutateRejectDossierRemedyDraft({ request: arg })
            if (!result.data) throw new Error("rejectDossierRemedyDraft answered no data")
            return result.data.rejectDossierRemedyDraft
        },
    )
