"use client"

import type { ReactNode } from "react"
import { useBrainPageHeader } from "@/hooks/brain"
import type { BrainTab } from "@/modules/routes"
import type { BrainPageHeading } from "@/modules/types"
import { BrainPageFrameBase } from "./component"

/** What the page hands the frame: the open tab, the header without its tabs and the body. */
interface BrainPageFrameProps {
    readonly selected: BrainTab
    readonly header: BrainPageHeading
    readonly children: ReactNode
}

/** The Second Brain page of a tab that sits in the page measure: the header with the tabs, then the body. */
export const BrainPageFrame = (props: BrainPageFrameProps) => {
    const header = useBrainPageHeader(props.selected, props.header)
    return <BrainPageFrameBase props={header.props} on={header.on} children={props.children} />
}
