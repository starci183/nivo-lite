"use client"

import useSWRMutation from "swr/mutation"
import { mutateRequestDossierReview } from "@/modules/api/graphql/mutations/mutation-request-dossier-review"
import type { MutateRequestDossierReviewRequest } from "@/modules/api/graphql/mutations/mutation-request-dossier-review"
import type { SWRMutationResponse } from "swr/mutation"
import type { OperationData } from "@/hooks/workspaceread"

/** What the RequestDossierReview mutation is triggered with. */
interface RequestDossierReviewArg {
    readonly arg: MutateRequestDossierReviewRequest
}

/** The SWR key of the requestDossierReview mutation. */
export const MUTATE_REQUEST_DOSSIER_REVIEW_SWR_KEY = "MUTATE_REQUEST_DOSSIER_REVIEW_SWR"

/** SWR mutation for {@link mutateRequestDossierReview}: asks for a review of one dossier, or of the whole set when no dossier is named; a run already queued answers as it is. `trigger(input)` rejects with the back end failure. */
export const useMutateRequestDossierReviewSwr = (): SWRMutationResponse<
    OperationData<typeof mutateRequestDossierReview>["requestDossierReview"],
    Error,
    typeof MUTATE_REQUEST_DOSSIER_REVIEW_SWR_KEY,
    RequestDossierReviewArg["arg"]
> =>
    useSWRMutation(MUTATE_REQUEST_DOSSIER_REVIEW_SWR_KEY, async (_key: string, { arg }: RequestDossierReviewArg) => {
        const result = await mutateRequestDossierReview({ request: arg })
        if (!result.data) throw new Error("requestDossierReview answered no data")
        return result.data.requestDossierReview
    })
