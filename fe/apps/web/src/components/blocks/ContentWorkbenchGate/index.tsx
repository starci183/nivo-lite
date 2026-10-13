"use client"

import type { ReactNode } from "react"
import { useContentGate } from "@/hooks/content"
import { ContentWorkbenchGateBase } from "./component"

/** What the page tells the gate. */
interface ContentWorkbenchGateProps {
    /** The blocks that need the workbench data. */
    readonly children: ReactNode
    /** The post that must exist for the blocks below to open. */
    readonly focus?: string | null
    /** Whether the member must be allowed to manage the content. */
    readonly requireManage?: boolean
    /** The name of the panel: while the workbench is read the gate draws its skeleton under this name; without it, nothing. */
    readonly placeholder?: string
}

/** Lets the blocks below it render once the content workbench is read (and, when asked, holds the post or the right to manage). */
export const ContentWorkbenchGate = (props: ContentWorkbenchGateProps) => {
    const state = useContentGate(props)
    return (
        <ContentWorkbenchGateBase
            state={{ content: props.children }}
            props={{ state, placeholder: props.placeholder ?? null }}
        />
    )
}
