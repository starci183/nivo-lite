import { useGraphQLMutationSwr } from "@/hooks/reuseables"
import { mutateCheckMeta } from "@/modules/api/graphql/mutations/mutation-check-meta"

/** The SWR key of the checkMeta mutation. */
export const MUTATE_CHECK_META_SWR_KEY = "MUTATE_CHECK_META_SWR"

/** SWR mutation for {@link mutateCheckMeta}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateCheckMetaSwr = () =>
    useGraphQLMutationSwr(MUTATE_CHECK_META_SWR_KEY, mutateCheckMeta, (data) => data.checkMeta)
