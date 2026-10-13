"use client"

import { useOverviewHeader } from "@/hooks/overview"
import { OverviewHeaderBase } from "./component"

/** The connected overview heading: the greeting, the time of the reading and the two actions. */
export const OverviewHeader = () => {
    const header = useOverviewHeader()
    if (header === undefined) return null
    return <OverviewHeaderBase props={header} />
}
