"use client"

import useSWRMutation from "swr/mutation"
import {
    mutateCreateApiKey,
    type MutateCreateApiKeyRequest,
} from "@/modules/api/graphql/mutations/mutation-create-api-key"
import type { SWRMutationResponse } from "swr/mutation"
import type { CreateApiKeyMutation } from "@/modules/api"

/** What the create API key mutation is triggered with. */
interface CreateApiKeyArg {
    readonly arg: MutateCreateApiKeyRequest
}

/** The SWR key of the create API key mutation. */
export const MUTATE_CREATE_API_KEY_SWR_KEY = "MUTATE_CREATE_API_KEY_SWR"

/** SWR mutation for {@link mutateCreateApiKey}: `trigger({ name })` answers the key (secret shown once) and rejects with the back end failure. */
export const useMutateCreateApiKeySwr = (): SWRMutationResponse<
    CreateApiKeyMutation["createApiKey"],
    Error,
    typeof MUTATE_CREATE_API_KEY_SWR_KEY,
    CreateApiKeyArg["arg"]
> =>
    useSWRMutation(MUTATE_CREATE_API_KEY_SWR_KEY, async (_key: string, { arg }: CreateApiKeyArg) => {
        const result = await mutateCreateApiKey({ request: arg })
        if (!result.data) throw new Error("createApiKey answered no data")
        return result.data.createApiKey
    })
