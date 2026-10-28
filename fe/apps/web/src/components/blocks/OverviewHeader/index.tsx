"use client"

import { useOverviewHeader } from "@/hooks/overview"
import { OVERVIEW_HEADER_PLACEHOLDER, OverviewHeaderBase } from "./component"
import type { OverviewHeaderPart } from "./component"

/** The slot of the page head to fill. */
interface OverviewHeaderProps {
    readonly part: OverviewHeaderPart
}

/** One connected slot of the overview page head; inert geometry until the dashboard is read. */
export const OverviewHeader = (props: OverviewHeaderProps) => {
    const header = useOverviewHeader()
    return (
        <OverviewHeaderBase
            props={{ ...(header ?? OVERVIEW_HEADER_PLACEHOLDER), part: props.part, isSkeleton: header === undefined }}
        />
    )
}
