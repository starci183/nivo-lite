"use client"

import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import {
    mutateRenameApiKey,
    type MutateRenameApiKeyRequest,
} from "@/modules/api/graphql/mutations/mutation-rename-api-key"
import type { RenameApiKeyMutation } from "@/modules/api"

/** What the rename API key mutation is triggered with. */
interface RenameApiKeyArg {
    readonly arg: MutateRenameApiKeyRequest
}

/** The SWR key of the rename API key mutation. */
export const MUTATE_RENAME_API_KEY_SWR_KEY = "MUTATE_RENAME_API_KEY_SWR"

/** SWR mutation for {@link mutateRenameApiKey}: `trigger({ keyId, name })` answers the renamed key and rejects with the back end failure. */
export const useMutateRenameApiKeySwr = (): SWRMutationResponse<
    RenameApiKeyMutation["renameApiKey"],
    Error,
    typeof MUTATE_RENAME_API_KEY_SWR_KEY,
    RenameApiKeyArg["arg"]
> =>
    useSWRMutation(MUTATE_RENAME_API_KEY_SWR_KEY, async (_key: string, { arg }: RenameApiKeyArg) => {
        const result = await mutateRenameApiKey({ request: arg })
        if (!result.data) throw new Error("renameApiKey answered no data")
        return result.data.renameApiKey
    })
