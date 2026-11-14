"use client"

import useSWR from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { queryProviderSandbox } from "@/modules/api/graphql/queries/query-provider-sandbox"
import { answeredData, type ReadResponse } from "@/hooks/workspaceread"
import type { ProviderSandboxQuery } from "@/modules/api"

/** The SWR key of the providerSandbox query. */
export const QUERY_PROVIDER_SANDBOX_SWR_KEY = "QUERY_PROVIDER_SANDBOX_SWR"

/** Whether the dev switch of the sandbox is on; `enabled` false waits. */
export const useQueryProviderSandboxSwr = (enabled = true): ReadResponse<ProviderSandboxQuery["providerSandbox"]> =>
    useSWR(
        useWorkspaceKey(QUERY_PROVIDER_SANDBOX_SWR_KEY, [], enabled),
        async ({ signal }: { signal?: AbortSignal } = {}) =>
            answeredData(await queryProviderSandbox({ signal }), "providerSandbox").providerSandbox,
    )
