"use client"

import useSWR from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { querySandboxAccounts } from "@/modules/api/graphql/queries/query-sandbox-accounts"
import { answeredData, type ReadResponse } from "@/hooks/workspaceread"
import type { SandboxAccountsQuery } from "@/modules/api"

/** The SWR key of the sandboxAccounts query. */
export const QUERY_SANDBOX_ACCOUNTS_SWR_KEY = "QUERY_SANDBOX_ACCOUNTS_SWR"

/** The sandbox accounts of the workspace; `enabled` false waits. */
export const useQuerySandboxAccountsSwr = (enabled = true): ReadResponse<SandboxAccountsQuery["sandboxAccounts"]> =>
    useSWR(
        useWorkspaceKey(QUERY_SANDBOX_ACCOUNTS_SWR_KEY, [], enabled),
        async ({ signal }: { signal?: AbortSignal } = {}) =>
            answeredData(await querySandboxAccounts({ signal }), "sandboxAccounts").sandboxAccounts,
    )
