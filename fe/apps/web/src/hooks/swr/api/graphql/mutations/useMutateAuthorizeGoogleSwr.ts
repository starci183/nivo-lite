import { useGraphQLMutationSwr } from "@/hooks/reuseables"
import { mutateAuthorizeGoogle } from "@/modules/api/graphql/mutations/mutation-authorize-google"

/** The SWR key of the authorizeGoogle mutation. */
export const MUTATE_AUTHORIZE_GOOGLE_SWR_KEY = "MUTATE_AUTHORIZE_GOOGLE_SWR"

/** SWR mutation for {@link mutateAuthorizeGoogle}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateAuthorizeGoogleSwr = () =>
    useGraphQLMutationSwr(MUTATE_AUTHORIZE_GOOGLE_SWR_KEY, mutateAuthorizeGoogle, (data) => data.authorizeGoogle)
