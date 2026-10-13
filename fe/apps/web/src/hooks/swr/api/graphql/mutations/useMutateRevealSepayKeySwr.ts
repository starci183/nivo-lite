import useSWRMutation from "swr/mutation"
import { mutateRevealSepayKey } from "@/modules/api/graphql/mutations/mutation-reveal-sepay-key"
import type { MutateRevealSepayKeyRequest } from "@/modules/api/graphql/mutations/mutation-reveal-sepay-key"

/** What the revealSepayKey mutation is triggered with. */
interface RevealSepayKeyArg {
    readonly arg: MutateRevealSepayKeyRequest
}

/** The SWR key of the revealSepayKey mutation. */
export const MUTATE_REVEAL_SEPAY_KEY_SWR_KEY = "MUTATE_REVEAL_SEPAY_KEY_SWR"

/** SWR mutation for {@link mutateRevealSepayKey}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateRevealSepayKeySwr = () =>
    useSWRMutation(MUTATE_REVEAL_SEPAY_KEY_SWR_KEY, async (_key: string, { arg }: RevealSepayKeyArg) => {
        const result = await mutateRevealSepayKey({ request: arg })
        if (result.data === undefined || result.data === null) throw new Error("revealSepayKey answered no data")
        return result.data.revealSepayKey
    })
