"use client"

import { useCallback, useState } from "react"
import type { ReadPage, ReadVariables } from "@nivo-lite/agent-sdk/block"
import type { HostRead, HostReadOptions } from "@nivo-lite/agent-sdk/client"
import { useQueryWorkbenchMoreSwr, useQueryWorkbenchReadSwr } from "@/hooks/swr"
import { readError } from "@/hooks/workspaceread"
import { isForbiddenFailure } from "@/modules/failure"
import { accumulated, currentMore, pageOf, withPage } from "@/modules/workbench-host"

/** The variable a list read pages with: the cursor the last page left. */
const CURSOR_VARIABLE = "cursor"

/** Where the pages after the first stand: loaded, loading, or failed. */
interface Paging {
    readonly more: ReturnType<typeof currentMore>
    readonly isLoadingMore: boolean
    readonly failure: boolean
}

const FIRST_PAGE_ONLY: Paging = { more: null, isLoadingMore: false, failure: false }

/** The status of a read that has not settled, by what SWR knows of it. */
const statusOf = (isLoading: boolean, error: unknown): HostRead["status"] => {
    if (error === undefined) return isLoading ? "loading" : "ready"
    return isForbiddenFailure(error) ? "forbidden" : "error"
}

/**
 * One read of the live data port: the generic read operation under the SWR key `[name, workspace, operation, variables]` (null
 * variables do not fetch). A paged read answers `{ rows, cursor }`; `loadMore` reads the next page with the cursor and appends its
 * rows, and a first page that changed drops the appended ones.
 */
export const useWorkbenchGraphqlRead = (
    operation: string,
    variables: ReadVariables | null,
    options?: HostReadOptions,
): HostRead => {
    const read = useQueryWorkbenchReadSwr(operation, variables)
    const { trigger } = useQueryWorkbenchMoreSwr()
    const [paging, setPaging] = useState<Paging>(FIRST_PAGE_ONLY)
    const first: unknown = read.data
    const more = currentMore(paging.more, first)
    const data = accumulated(first, more)
    const cursor = pageOf(data)?.cursor ?? null
    const loadMore = useCallback((): void => {
        if (variables === null || cursor === null || paging.isLoadingMore) return
        setPaging({ more, isLoadingMore: true, failure: false })
        trigger({ name: operation, variables: { ...variables, [CURSOR_VARIABLE]: cursor } })
            .then((answer) => {
                const page = pageOf(answer)
                if (page === null) throw new RangeError(`${operation} answered a page without rows`)
                setPaging({ more: withPage(first, more, page), isLoadingMore: false, failure: false })
            })
            .catch(() => setPaging({ more, isLoadingMore: false, failure: true }))
    }, [cursor, first, more, operation, paging.isLoadingMore, trigger, variables])
    const page: ReadPage | null =
        options?.isPaged === true
            ? { hasMore: cursor !== null, isLoadingMore: paging.isLoadingMore, failure: paging.failure, loadMore }
            : null
    return {
        status: statusOf(read.isLoading, readError(read)),
        data,
        isValidating: read.isValidating,
        reload: () => {
            setPaging(FIRST_PAGE_ONLY)
            void read.mutate()
        },
        page,
    }
}
