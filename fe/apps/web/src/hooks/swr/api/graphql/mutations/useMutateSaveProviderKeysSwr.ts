import useSWRMutation from "swr/mutation"
import { mutateSaveProviderKeys } from "@/modules/api/graphql/mutations/mutation-save-provider-keys"
import type { MutateSaveProviderKeysRequest } from "@/modules/api/graphql/mutations/mutation-save-provider-keys"

/** What the saveProviderKeys mutation is triggered with. */
interface SaveProviderKeysArg {
    readonly arg: MutateSaveProviderKeysRequest
}

/** The SWR key of the saveProviderKeys mutation. */
export const MUTATE_SAVE_PROVIDER_KEYS_SWR_KEY = "MUTATE_SAVE_PROVIDER_KEYS_SWR"

/** SWR mutation for {@link mutateSaveProviderKeys}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateSaveProviderKeysSwr = () =>
    useSWRMutation(MUTATE_SAVE_PROVIDER_KEYS_SWR_KEY, async (_key: string, { arg }: SaveProviderKeysArg) => {
        const result = await mutateSaveProviderKeys({ request: arg })
        if (result.data === undefined || result.data === null) throw new Error("saveProviderKeys answered no data")
        return result.data.saveProviderKeys
    })
