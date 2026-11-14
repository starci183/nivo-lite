"use client"

import useSWR from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { querySandboxCases } from "@/modules/api/graphql/queries/query-sandbox-cases"
import { answeredData, type WorkspaceReadKey, type ReadResponse } from "@/hooks/workspaceread"
import type { SandboxCasesQuery } from "@/modules/api"

/** The SWR key of the sandboxCases query. */
export const QUERY_SANDBOX_CASES_SWR_KEY = "QUERY_SANDBOX_CASES_SWR"

/** Reads the cases of the provider a key names. */
const read = async (key: WorkspaceReadKey<string>) => {
    const answer = await querySandboxCases({ request: { provider: key[2] } })
    return answeredData(answer, "sandboxCases").sandboxCases
}

/** The hardcoded cases of one provider; `undefined` waits. */
export const useQuerySandboxCasesSwr = (
    provider: string | undefined,
): ReadResponse<SandboxCasesQuery["sandboxCases"]> => {
    return useSWR(useWorkspaceKey(QUERY_SANDBOX_CASES_SWR_KEY, [provider ?? ""], provider !== undefined), read)
}
