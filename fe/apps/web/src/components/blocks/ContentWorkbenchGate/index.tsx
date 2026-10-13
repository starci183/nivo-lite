"use client"

import type { ReactNode } from "react"
import { useContentGate } from "@/hooks/content"

/** What the page tells the gate. */
interface ContentWorkbenchGateProps {
    /** The blocks that need the workbench data. */
    readonly children: ReactNode
    /** The post that must exist for the blocks below to open. */
    readonly focus?: string | null
    /** Whether the member must be allowed to manage the content. */
    readonly requireManage?: boolean
}

/** Lets the blocks below it render once the content workbench is read (and, when asked, holds the post or the right to manage). */
export const ContentWorkbenchGate = (props: ContentWorkbenchGateProps) => {
    const ready = useContentGate(props)
    return ready ? props.children : null
}
