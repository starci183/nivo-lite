import { useGraphQLMutationSwr } from "@/hooks/reuseables"
import { mutateRevealSepayKey } from "@/modules/api/graphql/mutations/mutation-reveal-sepay-key"

/** The SWR key of the revealSepayKey mutation. */
export const MUTATE_REVEAL_SEPAY_KEY_SWR_KEY = "MUTATE_REVEAL_SEPAY_KEY_SWR"

/** SWR mutation for {@link mutateRevealSepayKey}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateRevealSepayKeySwr = () =>
    useGraphQLMutationSwr(MUTATE_REVEAL_SEPAY_KEY_SWR_KEY, mutateRevealSepayKey, (data) => data.revealSepayKey)
