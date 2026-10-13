import { useGraphQLMutationSwr } from "@/hooks/reuseables"
import { mutateAuthorizeZalo } from "@/modules/api/graphql/mutations/mutation-authorize-zalo"

/** The SWR key of the authorizeZalo mutation. */
export const MUTATE_AUTHORIZE_ZALO_SWR_KEY = "MUTATE_AUTHORIZE_ZALO_SWR"

/** SWR mutation for {@link mutateAuthorizeZalo}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateAuthorizeZaloSwr = () =>
    useGraphQLMutationSwr(MUTATE_AUTHORIZE_ZALO_SWR_KEY, mutateAuthorizeZalo, (data) => data.authorizeZalo)
