import { useGraphQLMutationSwr } from "@/hooks/reuseables"
import { mutateSaveZaloOaSecret } from "@/modules/api/graphql/mutations/mutation-save-zalo-oa-secret"

/** The SWR key of the saveZaloOaSecret mutation. */
export const MUTATE_SAVE_ZALO_OA_SECRET_SWR_KEY = "MUTATE_SAVE_ZALO_OA_SECRET_SWR"

/** SWR mutation for {@link mutateSaveZaloOaSecret}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateSaveZaloOaSecretSwr = () =>
    useGraphQLMutationSwr(MUTATE_SAVE_ZALO_OA_SECRET_SWR_KEY, mutateSaveZaloOaSecret, (data) => data.saveZaloOaSecret)
