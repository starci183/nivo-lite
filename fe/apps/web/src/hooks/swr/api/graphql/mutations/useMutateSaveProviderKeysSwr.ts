"use client"

import {
    mutateSaveProviderKeys,
    type MutateSaveProviderKeysRequest,
} from "@/modules/api/graphql/mutations/mutation-save-provider-keys"
import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import { answeredData } from "@/hooks/workspaceread"
import type { SaveProviderKeysMutation } from "@/modules/api"

/** The SWR key of the saveProviderKeys mutation. */
export const MUTATE_SAVE_PROVIDER_KEYS_SWR_KEY = "MUTATE_SAVE_PROVIDER_KEYS_SWR"

/** SWR mutation for {@link mutateSaveProviderKeys}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateSaveProviderKeysSwr = (): SWRMutationResponse<
    SaveProviderKeysMutation["saveProviderKeys"],
    Error,
    typeof MUTATE_SAVE_PROVIDER_KEYS_SWR_KEY,
    TriggerArg["arg"]
> =>
    useSWRMutation(
        MUTATE_SAVE_PROVIDER_KEYS_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateSaveProviderKeys({ request: arg }), MUTATE_SAVE_PROVIDER_KEYS_SWR_KEY)
                .saveProviderKeys,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: MutateSaveProviderKeysRequest
}
