import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { useAppSelector } from "@/redux"

/** The part of an Apollo query result the hook reads. */
interface QueryAnswer<TData> {
    readonly data?: TData | null
}

/**
 * The one SWR read shape of every workspace-scoped GraphQL query: the cache identity is the key, the active workspace and the
 * `params` (`null` keeps the read idle), the fetcher runs the operation file and answers the payload `pick` takes out of the data.
 */
export const useWorkspaceQuerySwr = <TParams extends readonly unknown[], TData, TPayload>(
    key: string,
    params: TParams | null,
    run: (params: TParams) => Promise<QueryAnswer<TData>>,
    pick: (data: TData) => TPayload,
    options?: SWRConfiguration<TPayload, Error>,
) => {
    const workspaceId = useAppSelector((state) => state.workspace.activeWorkspaceId)
    const swrKey: readonly [string, string, ...TParams] | null =
        workspaceId && params ? [key, workspaceId, ...params] : null
    return useSWR(
        swrKey,
        async ([, , ...rest]: readonly [string, string, ...TParams]): Promise<TPayload> => {
            const result = await run(rest)
            if (result.data === undefined || result.data === null) throw new Error(`${key} answered no data`)
            return pick(result.data)
        },
        options,
    )
}
