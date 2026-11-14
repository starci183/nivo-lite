"use client"

import useSWR from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { querySandboxCalls } from "@/modules/api/graphql/queries/query-sandbox-calls"
import { answeredData, type WorkspaceReadKey, type ReadResponse } from "@/hooks/workspaceread"
import type { SandboxCallsQuery } from "@/modules/api"

/** The SWR key of the sandboxCalls query. */
export const QUERY_SANDBOX_CALLS_SWR_KEY = "QUERY_SANDBOX_CALLS_SWR"

/** How often the read asks again, so what the agents did meanwhile shows without a reload (milliseconds). */
const REFRESH_MS = 8000

/** The call log of one sandbox account, oldest first; `undefined` waits. */
export const useQuerySandboxCallsSwr = (
    connectionId: string | undefined,
): ReadResponse<SandboxCallsQuery["sandboxCalls"]> =>
    useSWR(
        useWorkspaceKey(QUERY_SANDBOX_CALLS_SWR_KEY, [connectionId ?? ""], connectionId !== undefined),
        async ([, , value]: WorkspaceReadKey<string>) =>
            answeredData(await querySandboxCalls({ request: { connectionId: value } }), "sandboxCalls").sandboxCalls,
        { refreshInterval: REFRESH_MS },
    )
