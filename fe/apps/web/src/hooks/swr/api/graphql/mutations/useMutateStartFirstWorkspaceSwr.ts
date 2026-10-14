"use client"

import useSWR, { useSWRConfig } from "swr"
import { mutateStartFirstWorkspace } from "@/modules/api/graphql/mutations/mutation-start-first-workspace"
import { QUERY_MY_WORKSPACES_SWR_KEY } from "../queries/useQueryMyWorkspacesSwr"

/** The SWR key of the start first workspace mutation. */
export const MUTATE_START_FIRST_WORKSPACE_SWR_KEY = "MUTATE_START_FIRST_WORKSPACE_SWR"

/**
 * {@link mutateStartFirstWorkspace} once, while `enabled` (the person has no membership at all): answers the new workspace id, or null
 * when none was created. A created workspace refreshes the workspaces list. The back end creates at most one, so a repeat is harmless.
 */
export const useMutateStartFirstWorkspaceSwr = (enabled: boolean) => {
    const { mutate } = useSWRConfig()
    return useSWR(
        enabled ? MUTATE_START_FIRST_WORKSPACE_SWR_KEY : null,
        async () => {
            const result = await mutateStartFirstWorkspace()
            if (!result.data) throw new Error("startFirstWorkspace answered no data")
            return result.data.startFirstWorkspace.id ?? null
        },
        {
            revalidateIfStale: false,
            revalidateOnFocus: false,
            revalidateOnReconnect: false,
            shouldRetryOnError: false,
            onSuccess: (workspaceId) => {
                if (workspaceId !== null) void mutate(QUERY_MY_WORKSPACES_SWR_KEY)
            },
        },
    )
}
