import {
    WorkbenchHostProvider,
    type BlockRenderer,
    type RegistryCheck,
    type WorkbenchHost,
} from "@nivo-lite/agent-sdk/client"
import type { ReactNode } from "react"

/** What the pure half takes: the host, the installed blocks, the enabled modules and the registry comparison to mount, and what they wrap. */
export interface WorkbenchHostLayoutBaseProps {
    readonly props: {
        readonly host: WorkbenchHost
        readonly blocks: ReadonlyArray<BlockRenderer>
        readonly enabled: ReadonlyArray<string>
        readonly registry: RegistryCheck | null
    }
    readonly children: ReactNode
}

/** Mounts the host of the workbench renderer once, with the blocks installed in this bundle; every spec block below reads and acts through it. */
export const WorkbenchHostLayoutBase = (props: WorkbenchHostLayoutBaseProps) => (
    <WorkbenchHostProvider
        host={props.props.host}
        blocks={props.props.blocks}
        enabled={props.props.enabled}
        registry={props.props.registry}
    >
        {props.children}
    </WorkbenchHostProvider>
)
