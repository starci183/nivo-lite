"use client"

import useSWRMutation from "swr/mutation"
import { mutateRespondHiringOffer } from "@/modules/api/graphql/mutations/mutation-respond-hiring-offer"
import type { MutateRespondHiringOfferRequest } from "@/modules/api/graphql/mutations/mutation-respond-hiring-offer"
import type { SWRMutationResponse } from "swr/mutation"
import type { OperationData } from "@/hooks/workspaceread"

/** What the respondHiringOffer mutation is triggered with. */
interface RespondHiringOfferArg {
    readonly arg: MutateRespondHiringOfferRequest
}

/** The SWR key of the `respondHiringOffer` mutation. */
export const MUTATE_RESPOND_HIRING_OFFER_SWR_KEY = "MUTATE_RESPOND_HIRING_OFFER_SWR"

/** SWR mutation for {@link mutateRespondHiringOffer}: `trigger(request)` answers `respondHiringOffer` and rejects with the back end failure. */
export const useMutateRespondHiringOfferSwr = (): SWRMutationResponse<
    OperationData<typeof mutateRespondHiringOffer>["respondHiringOffer"],
    Error,
    typeof MUTATE_RESPOND_HIRING_OFFER_SWR_KEY,
    RespondHiringOfferArg["arg"]
> =>
    useSWRMutation(MUTATE_RESPOND_HIRING_OFFER_SWR_KEY, async (_key: string, { arg }: RespondHiringOfferArg) => {
        const result = await mutateRespondHiringOffer({ request: arg })
        if (!result.data) throw new Error("respondHiringOffer answered no data")
        return result.data.respondHiringOffer
    })
