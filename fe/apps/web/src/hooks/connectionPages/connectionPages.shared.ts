import { unstable_serialize } from "swr/infinite"
import type { SWRInfiniteResponse } from "swr/infinite"

/** One forward page of a workspace list. */
export interface ConnectionPage<Node> {
    readonly nodes: ReadonlyArray<Node>
    readonly pageInfo: {
        readonly endCursor: string | null
        readonly hasNextPage: boolean
    }
}

/** The identity of one page, including its workspace and opaque position. */
export type ConnectionPageKey = readonly [name: string, workspaceId: string, after: string | null]

/** The bounded size requested by each list and directory page. */
const CONNECTION_PAGE_SIZE = 50

/** The bounded cursor request sent by a connection reader. */
interface ConnectionPageRequest {
    readonly first: number
    readonly after: string | null
}

/** The variables and workspace header belonging to one cached page. */
interface ConnectionReadParameters {
    readonly request: ConnectionPageRequest
    readonly headers: Readonly<Record<string, string>>
}

/** Builds page variables and the matching workspace header without calling an API operation. */
export const connectionReadParameters = (key: ConnectionPageKey, workspaceHeader: string): ConnectionReadParameters => {
    const [, workspaceId, after] = key
    return {
        request: { first: CONNECTION_PAGE_SIZE, after },
        headers: { [workspaceHeader]: workspaceId },
    }
}

/** The aggregate key used when a write refreshes every loaded page of a connection. */
export const connectionCacheKey = (name: string, workspaceId: string): string =>
    unstable_serialize(() => [name, workspaceId, null])

/** Stops a cursor chain at its terminal page or until its workspace is known. */
export const connectionPageKey = (
    name: string,
    workspaceId: string | undefined,
    index: number,
    previous: ConnectionPage<unknown> | null,
): ConnectionPageKey | null => {
    if (workspaceId === undefined || (previous !== null && !previous.pageInfo.hasNextPage)) return null
    const after = index === 0 ? null : (previous?.pageInfo.endCursor ?? null)
    return index > 0 && after === null ? null : [name, workspaceId, after]
}

/** Flattens loaded pages while preserving rows and offering a retry when the next read fails. */
export const connectionPageView = <Node extends { readonly id: string }>(
    query: SWRInfiniteResponse<ConnectionPage<Node>, Error>,
) => {
    const pages = query.data
    const last = pages?.at(-1)
    const loadedIds = new Set<string>()
    const data = pages
        ?.flatMap((page) => page.nodes)
        .filter((node) => {
            if (loadedIds.has(node.id)) return false
            loadedIds.add(node.id)
            return true
        })
    const hasNextPage = last?.pageInfo.hasNextPage ?? false
    const isLoadingMore = query.isValidating && pages !== undefined
    const loadMore = () => {
        if (!hasNextPage || query.isValidating) return
        if (query.error !== undefined) {
            void query.mutate()
            return
        }
        void query.setSize(query.size + 1)
    }
    return {
        ...query,
        data,
        hasNextPage,
        isLoadingMore,
        paginationError: pages === undefined ? undefined : query.error,
        error: pages === undefined ? query.error : undefined,
        loadMore,
        retry: () => void query.mutate(),
    }
}
