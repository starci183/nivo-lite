import useSWRMutation from "swr/mutation"
import { mutateCreateApiKey } from "@/modules/api/graphql/mutations/mutation-create-api-key"
import type { MutateCreateApiKeyRequest } from "@/modules/api/graphql/mutations/mutation-create-api-key"

/** What the create API key mutation is triggered with. */
interface CreateApiKeyArg {
    readonly arg: MutateCreateApiKeyRequest
}

/** The SWR key of the create API key mutation. */
export const MUTATE_CREATE_API_KEY_SWR_KEY = "MUTATE_CREATE_API_KEY_SWR"

/** SWR mutation for {@link mutateCreateApiKey}: `trigger({ name })` answers the key (secret shown once) and rejects with the back end failure. */
export const useMutateCreateApiKeySwr = () =>
    useSWRMutation(MUTATE_CREATE_API_KEY_SWR_KEY, async (_key: string, { arg }: CreateApiKeyArg) => {
        const result = await mutateCreateApiKey({ request: arg })
        if (!result.data) throw new Error("createApiKey answered no data")
        return result.data.createApiKey
    })
