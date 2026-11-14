"use client"

import { useSearchParams } from "next/navigation"
import { useContext } from "react"
import type { ReadPage, ReadVariables } from "@nivo-lite/agent-sdk/block"
import type { HostRead, HostReadOptions } from "@nivo-lite/agent-sdk/client"
import { useReportReadFreshness } from "@/hooks/workbenchHost"
import { FIXTURE_QUERY_KEY, FixtureTablesContext, fixtureModeOf, fixtureReadOf } from "@/modules/workbench-host"

const idle = (): void => undefined

/** The paging a fixture list shows: one page, nothing more to load. */
const LAST_PAGE: ReadPage = { hasMore: false, isLoadingMore: false, failure: false, loadMore: idle }

/**
 * One read of the prototype data port: answers from the fixture of the operation. The `fixture` key of the URL query forces the state
 * (`loading`, `empty`, `error`, `forbidden`) for a screenshot; a read nobody wrote a fixture for is an error, never invented data.
 * Null variables do not read, like the live port.
 */
export const useWorkbenchFixtureRead = (
    operation: string,
    variables: ReadVariables | null,
    options?: HostReadOptions,
): HostRead => {
    const tables = useContext(FixtureTablesContext)
    const mode = fixtureModeOf(useSearchParams().get(FIXTURE_QUERY_KEY))
    const source = tables.reads[operation]
    const page = options?.isPaged === true ? LAST_PAGE : null
    const answer = variables === null || source === undefined ? null : source(variables)
    const readOf = (): HostRead => {
        if (variables === null) return fixtureReadOf("loading", null)
        if (source === undefined) return fixtureReadOf("error", null)
        return fixtureReadOf(mode, answer)
    }
    const read = readOf()
    useReportReadFreshness(operation, read.status === "ready" ? answer : null)
    return { ...read, page }
}
