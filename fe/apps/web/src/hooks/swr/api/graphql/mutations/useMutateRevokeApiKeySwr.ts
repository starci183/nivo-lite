"use client"

import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import {
    mutateRevokeApiKey,
    type MutateRevokeApiKeyRequest,
} from "@/modules/api/graphql/mutations/mutation-revoke-api-key"
import type { RevokeApiKeyMutation } from "@/modules/api"

/** What the revoke API key mutation is triggered with. */
interface RevokeApiKeyArg {
    readonly arg: MutateRevokeApiKeyRequest
}

/** The SWR key of the revoke API key mutation. */
export const MUTATE_REVOKE_API_KEY_SWR_KEY = "MUTATE_REVOKE_API_KEY_SWR"

/** SWR mutation for {@link mutateRevokeApiKey}: `trigger({ keyId })` answers the revoked key and rejects with the back end failure. */
export const useMutateRevokeApiKeySwr = (): SWRMutationResponse<
    RevokeApiKeyMutation["revokeApiKey"],
    Error,
    typeof MUTATE_REVOKE_API_KEY_SWR_KEY,
    RevokeApiKeyArg["arg"]
> =>
    useSWRMutation(MUTATE_REVOKE_API_KEY_SWR_KEY, async (_key: string, { arg }: RevokeApiKeyArg) => {
        const result = await mutateRevokeApiKey({ request: arg })
        if (!result.data) throw new Error("revokeApiKey answered no data")
        return result.data.revokeApiKey
    })
