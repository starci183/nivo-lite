"use client"

import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import {
    mutateCancelHiringOffer,
    type MutateCancelHiringOfferRequest,
} from "@/modules/api/graphql/mutations/mutation-cancel-hiring-offer"
import type { CancelHiringOfferMutation } from "@/modules/api"

/** What the cancelHiringOffer mutation is triggered with. */
interface CancelHiringOfferArg {
    readonly arg: MutateCancelHiringOfferRequest
}

/** The SWR key of the `cancelHiringOffer` mutation. */
export const MUTATE_CANCEL_HIRING_OFFER_SWR_KEY = "MUTATE_CANCEL_HIRING_OFFER_SWR"

/** SWR mutation for {@link mutateCancelHiringOffer}: `trigger(request)` answers `cancelHiringOffer` and rejects with the back end failure. */
export const useMutateCancelHiringOfferSwr = (): SWRMutationResponse<
    CancelHiringOfferMutation["cancelHiringOffer"],
    Error,
    typeof MUTATE_CANCEL_HIRING_OFFER_SWR_KEY,
    CancelHiringOfferArg["arg"]
> =>
    useSWRMutation(MUTATE_CANCEL_HIRING_OFFER_SWR_KEY, async (_key: string, { arg }: CancelHiringOfferArg) => {
        const result = await mutateCancelHiringOffer({ request: arg })
        if (!result.data) throw new Error("cancelHiringOffer answered no data")
        return result.data.cancelHiringOffer
    })
