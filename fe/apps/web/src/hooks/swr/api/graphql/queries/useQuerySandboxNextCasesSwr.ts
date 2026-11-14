"use client"

import useSWR from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { querySandboxNextCases } from "@/modules/api/graphql/queries/query-sandbox-next-cases"
import { answeredData, type WorkspaceReadKey, type ReadResponse } from "@/hooks/workspaceread"
import type { SandboxNextCasesQuery } from "@/modules/api"

/** The SWR key of the sandboxNextCases query. */
export const QUERY_SANDBOX_NEXT_CASES_SWR_KEY = "QUERY_SANDBOX_NEXT_CASES_SWR"

/** How often the read asks again, so what the agents did meanwhile shows without a reload (milliseconds). */
const REFRESH_MS = 8000

/** The case each outbound operation of one sandbox account answers next; `undefined` waits. */
export const useQuerySandboxNextCasesSwr = (
    connectionId: string | undefined,
): ReadResponse<SandboxNextCasesQuery["sandboxNextCases"]> => {
    const key = useWorkspaceKey(QUERY_SANDBOX_NEXT_CASES_SWR_KEY, [connectionId ?? ""], connectionId !== undefined)
    return useSWR(
        key,
        async (current: WorkspaceReadKey<string>) => {
            const answer = await querySandboxNextCases({ request: { connectionId: current[2] } })
            return answeredData(answer, "sandboxNextCases").sandboxNextCases
        },
        { refreshInterval: REFRESH_MS },
    )
}
