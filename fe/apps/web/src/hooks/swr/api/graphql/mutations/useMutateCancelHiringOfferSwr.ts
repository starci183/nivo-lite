import useSWRMutation from "swr/mutation"
import { mutateCancelHiringOffer } from "@/modules/api/graphql/mutations/mutation-cancel-hiring-offer"
import type { MutateCancelHiringOfferRequest } from "@/modules/api/graphql/mutations/mutation-cancel-hiring-offer"

/** What the cancelHiringOffer mutation is triggered with. */
interface CancelHiringOfferArg {
    readonly arg: MutateCancelHiringOfferRequest
}

/** The SWR key of the `cancelHiringOffer` mutation. */
export const MUTATE_CANCEL_HIRING_OFFER_SWR_KEY = "MUTATE_CANCEL_HIRING_OFFER_SWR"

/** SWR mutation for {@link mutateCancelHiringOffer}: `trigger(request)` answers `cancelHiringOffer` and rejects with the back end failure. */
export const useMutateCancelHiringOfferSwr = () =>
    useSWRMutation(MUTATE_CANCEL_HIRING_OFFER_SWR_KEY, async (_key: string, { arg }: CancelHiringOfferArg) => {
        const result = await mutateCancelHiringOffer({ request: arg })
        if (!result.data) throw new Error("cancelHiringOffer answered no data")
        return result.data.cancelHiringOffer
    })
