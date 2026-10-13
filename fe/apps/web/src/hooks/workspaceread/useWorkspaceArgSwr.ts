import useSWR from "swr"
import type { SWRConfiguration } from "swr"

/** A GraphQL read of the active workspace for one argument: the cache key is `[name, workspaceId, arg]`; an `undefined` workspace or argument pauses it. */
export const useWorkspaceArgSwr = <Arg, Data>(
    name: string,
    workspaceId: string | undefined,
    arg: Arg | undefined,
    read: (arg: Arg) => Promise<Data>,
    options?: SWRConfiguration,
) =>
    useSWR(
        workspaceId === undefined || arg === undefined ? null : ([name, workspaceId, arg] as const),
        ([, , key]) => read(key),
        options,
    )
