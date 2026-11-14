"use client"

import useSWR from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { querySandboxKey } from "@/modules/api/graphql/queries/query-sandbox-key"
import { answeredData, type WorkspaceReadKey, type ReadResponse } from "@/hooks/workspaceread"
import type { SandboxKeyQuery } from "@/modules/api"

/** The SWR key of the sandboxKey query. */
export const QUERY_SANDBOX_KEY_SWR_KEY = "QUERY_SANDBOX_KEY_SWR"

/** The sandbox key of one account; `undefined` waits. */
export const useQuerySandboxKeySwr = (
    connectionId: string | undefined,
): ReadResponse<SandboxKeyQuery["sandboxKey"]> => {
    const key = useWorkspaceKey(QUERY_SANDBOX_KEY_SWR_KEY, [connectionId ?? ""], connectionId !== undefined)
    return useSWR(key, async (current: WorkspaceReadKey<string>) => {
        const answer = await querySandboxKey({ request: { connectionId: current[2] } })
        return answeredData(answer, "sandboxKey").sandboxKey
    })
}
