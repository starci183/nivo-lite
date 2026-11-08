"use client"

import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import {
    mutateRequestHiringOffer,
    type MutateRequestHiringOfferRequest,
} from "@/modules/api/graphql/mutations/mutation-request-hiring-offer"
import type { RequestHiringOfferMutation } from "@/modules/api"

/** What the requestHiringOffer mutation is triggered with. */
interface RequestHiringOfferArg {
    readonly arg: MutateRequestHiringOfferRequest
}

/** The SWR key of the `requestHiringOffer` mutation. */
export const MUTATE_REQUEST_HIRING_OFFER_SWR_KEY = "MUTATE_REQUEST_HIRING_OFFER_SWR"

/** SWR mutation for {@link mutateRequestHiringOffer}: `trigger(request)` answers `requestHiringOffer` and rejects with the back end failure. */
export const useMutateRequestHiringOfferSwr = (): SWRMutationResponse<
    RequestHiringOfferMutation["requestHiringOffer"],
    Error,
    typeof MUTATE_REQUEST_HIRING_OFFER_SWR_KEY,
    RequestHiringOfferArg["arg"]
> =>
    useSWRMutation(MUTATE_REQUEST_HIRING_OFFER_SWR_KEY, async (_key: string, { arg }: RequestHiringOfferArg) => {
        const result = await mutateRequestHiringOffer({ request: arg })
        if (!result.data) throw new Error("requestHiringOffer answered no data")
        return result.data.requestHiringOffer
    })
