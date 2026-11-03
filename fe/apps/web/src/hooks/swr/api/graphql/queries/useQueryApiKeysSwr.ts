"use client"

import { argumentKey } from "@/hooks/workspaceread"
import useSWR from "swr"
import { queryApiKeys } from "@/modules/api/graphql/queries/query-api-keys"
import type { OperationData, ReadResponse } from "@/hooks/workspaceread"

/** The SWR key of the API keys list; mutations that change it call `mutate` on it. */
export const QUERY_API_KEYS_SWR_KEY = "QUERY_API_KEYS_SWR"

/** The API keys of the workspace, never their secrets (the back end `apiKeys` query). */
export const useQueryApiKeysSwr = (
    workspaceId: string | undefined,
): ReadResponse<OperationData<typeof queryApiKeys>["apiKeys"]> =>
    useSWR(argumentKey(QUERY_API_KEYS_SWR_KEY, workspaceId), async () => {
        const result = await queryApiKeys()
        if (!result.data) throw new Error("apiKeys answered no data")
        return result.data.apiKeys
    })
