import { WorkbenchHostProvider } from "@nivo-lite/agent-sdk/client"
import type { WorkbenchHost } from "@nivo-lite/agent-sdk/client"
import type { ReactNode } from "react"

/** What the pure half takes: the host to mount and what it wraps. */
export interface WorkbenchHostLayoutBaseProps {
    readonly props: { readonly host: WorkbenchHost }
    readonly children: ReactNode
}

/** Mounts the host of the workbench renderer once; every spec block below reads and acts through it. */
export const WorkbenchHostLayoutBase = (props: WorkbenchHostLayoutBaseProps) => (
    <WorkbenchHostProvider host={props.props.host}>{props.children}</WorkbenchHostProvider>
)
