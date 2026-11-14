"use client"

import useSWR from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { querySandboxLatestRequest } from "@/modules/api/graphql/queries/query-sandbox-latest-request"
import { answeredData, type WorkspaceReadKey, type ReadResponse } from "@/hooks/workspaceread"
import type { SandboxLatestRequestQuery } from "@/modules/api"

/** The SWR key of the sandboxLatestRequest query. */
export const QUERY_SANDBOX_LATEST_REQUEST_SWR_KEY = "QUERY_SANDBOX_LATEST_REQUEST_SWR"

/** How often the read asks again, so what the agents did meanwhile shows without a reload (milliseconds). */
const REFRESH_MS = 8000

/** The newest request the agent logged on one sandbox account (the prefill of a send); `undefined` waits. */
export const useQuerySandboxLatestRequestSwr = (
    connectionId: string | undefined,
): ReadResponse<SandboxLatestRequestQuery["sandboxLatestRequest"]> =>
    useSWR(
        useWorkspaceKey(QUERY_SANDBOX_LATEST_REQUEST_SWR_KEY, [connectionId ?? ""], connectionId !== undefined),
        ([, , value]: WorkspaceReadKey<string>) =>
            querySandboxLatestRequest({ request: { connectionId: value } }).then(
                (answer) => answeredData(answer, "sandboxLatestRequest").sandboxLatestRequest,
            ),
        { refreshInterval: REFRESH_MS },
    )
