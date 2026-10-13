import useSWR from "swr"
import type { SWRConfiguration } from "swr"

/** A GraphQL read of the active workspace that needs no argument: the cache key is `[name, workspaceId]`; `undefined` workspace pauses it. */
export const useWorkspaceSwr = <Data>(
    name: string,
    workspaceId: string | undefined,
    read: () => Promise<Data>,
    options?: SWRConfiguration,
) => useSWR(workspaceId === undefined ? null : ([name, workspaceId] as const), read, options)
