"use client"

import useSWRMutation from "swr/mutation"
import { mutateRequestDossierRemedyDraft } from "@/modules/api/graphql/mutations/mutation-request-dossier-remedy-draft"
import type { MutateRequestDossierRemedyDraftRequest } from "@/modules/api/graphql/mutations/mutation-request-dossier-remedy-draft"

/** What the RequestDossierRemedyDraft mutation is triggered with. */
interface RequestDossierRemedyDraftArg {
    readonly arg: MutateRequestDossierRemedyDraftRequest
}

/** The SWR key of the requestDossierRemedyDraft mutation. */
export const MUTATE_REQUEST_DOSSIER_REMEDY_DRAFT_SWR_KEY = "MUTATE_REQUEST_DOSSIER_REMEDY_DRAFT_SWR"

/** SWR mutation for {@link mutateRequestDossierRemedyDraft}: asks NIVO to draft the document that completes a finding. `trigger(input)` rejects with the back end failure. */
export const useMutateRequestDossierRemedyDraftSwr = () =>
    useSWRMutation(
        MUTATE_REQUEST_DOSSIER_REMEDY_DRAFT_SWR_KEY,
        async (_key: string, { arg }: RequestDossierRemedyDraftArg) => {
            const result = await mutateRequestDossierRemedyDraft({ request: arg })
            if (!result.data) throw new Error("requestDossierRemedyDraft answered no data")
            return result.data.requestDossierRemedyDraft
        },
    )
