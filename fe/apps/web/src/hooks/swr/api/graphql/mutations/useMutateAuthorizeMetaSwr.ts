import { useGraphQLMutationSwr } from "@/hooks/reuseables"
import { mutateAuthorizeMeta } from "@/modules/api/graphql/mutations/mutation-authorize-meta"

/** The SWR key of the authorizeMeta mutation. */
export const MUTATE_AUTHORIZE_META_SWR_KEY = "MUTATE_AUTHORIZE_META_SWR"

/** SWR mutation for {@link mutateAuthorizeMeta}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateAuthorizeMetaSwr = () =>
    useGraphQLMutationSwr(MUTATE_AUTHORIZE_META_SWR_KEY, mutateAuthorizeMeta, (data) => data.authorizeMeta)
