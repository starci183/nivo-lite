"use client"

import useSWR from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { querySandboxProviders } from "@/modules/api/graphql/queries/query-sandbox-providers"
import { answeredData, type ReadResponse } from "@/hooks/workspaceread"
import type { SandboxProvidersQuery } from "@/modules/api"

/** The SWR key of the sandboxProviders query. */
export const QUERY_SANDBOX_PROVIDERS_SWR_KEY = "QUERY_SANDBOX_PROVIDERS_SWR"

/** The providers a sandbox account can be opened for; `enabled` false waits. */
export const useQuerySandboxProvidersSwr = (enabled = true): ReadResponse<SandboxProvidersQuery["sandboxProviders"]> =>
    useSWR(
        useWorkspaceKey(QUERY_SANDBOX_PROVIDERS_SWR_KEY, [], enabled),
        async ({ signal }: { signal?: AbortSignal } = {}) =>
            answeredData(await querySandboxProviders({ signal }), "sandboxProviders").sandboxProviders,
    )
