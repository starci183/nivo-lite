"use client"

import useSWRMutation from "swr/mutation"
import {
    mutateSaveOpenApiConnection,
    type MutateSaveOpenApiConnectionRequest,
} from "@/modules/api/graphql/mutations/mutation-save-open-api-connection"
import type { SWRMutationResponse } from "swr/mutation"
import type { SaveOpenApiConnectionMutation } from "@/modules/api"

/** What the saveOpenApiConnection mutation is triggered with. */
interface SaveOpenApiConnectionArg {
    readonly arg: MutateSaveOpenApiConnectionRequest
}

/** The SWR key of the saveOpenApiConnection mutation. */
export const MUTATE_SAVE_OPEN_API_CONNECTION_SWR_KEY = "MUTATE_SAVE_OPEN_API_CONNECTION_SWR"

/** SWR mutation for {@link mutateSaveOpenApiConnection}: `trigger(input)` answers the connection id and rejects with the back end failure. */
export const useMutateSaveOpenApiConnectionSwr = (): SWRMutationResponse<
    SaveOpenApiConnectionMutation["saveOpenApiConnection"],
    Error,
    typeof MUTATE_SAVE_OPEN_API_CONNECTION_SWR_KEY,
    SaveOpenApiConnectionArg["arg"]
> =>
    useSWRMutation(MUTATE_SAVE_OPEN_API_CONNECTION_SWR_KEY, async (_key: string, { arg }: SaveOpenApiConnectionArg) => {
        const result = await mutateSaveOpenApiConnection({ request: arg })
        if (result.data === undefined) throw new Error("saveOpenApiConnection answered no data")
        return result.data.saveOpenApiConnection
    })
