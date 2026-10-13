import { useGraphQLMutationSwr } from "@/hooks/reuseables"
import { mutateSaveProviderKeys } from "@/modules/api/graphql/mutations/mutation-save-provider-keys"

/** The SWR key of the saveProviderKeys mutation. */
export const MUTATE_SAVE_PROVIDER_KEYS_SWR_KEY = "MUTATE_SAVE_PROVIDER_KEYS_SWR"

/** SWR mutation for {@link mutateSaveProviderKeys}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateSaveProviderKeysSwr = () =>
    useGraphQLMutationSwr(MUTATE_SAVE_PROVIDER_KEYS_SWR_KEY, mutateSaveProviderKeys, (data) => data.saveProviderKeys)
