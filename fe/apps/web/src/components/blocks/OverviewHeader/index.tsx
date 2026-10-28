"use client"

import { useOverviewHeader } from "@/hooks/overview"
import { OVERVIEW_HEADER_PLACEHOLDER, OverviewHeaderBase } from "./component"

/** The connected overview heading: the greeting, the time of the reading and the two actions; inert geometry until the dashboard is read. */
export const OverviewHeader = () => {
    const header = useOverviewHeader()
    return (
        <OverviewHeaderBase props={{ ...(header ?? OVERVIEW_HEADER_PLACEHOLDER), isSkeleton: header === undefined }} />
    )
}
