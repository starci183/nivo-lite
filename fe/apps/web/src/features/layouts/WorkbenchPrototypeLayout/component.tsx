import { WorkbenchHostProvider } from "@nivo-lite/agent-sdk/client"
import type { WorkbenchHost } from "@nivo-lite/agent-sdk/client"
import type { ReactNode } from "react"
import { FixtureTablesContext, NO_FIXTURES } from "@/modules/workbench-host"

/** What the pure half takes: the host to mount and what it wraps. */
export interface WorkbenchPrototypeLayoutBaseProps {
    readonly props: { readonly host: WorkbenchHost }
    readonly children: ReactNode
}

/**
 * Mounts the prototype host with the fixtures it answers from. The fixtures of the modules are handed to the context here, once,
 * as they land.
 */
export const WorkbenchPrototypeLayoutBase = (props: WorkbenchPrototypeLayoutBaseProps) => (
    <FixtureTablesContext.Provider value={NO_FIXTURES}>
        <WorkbenchHostProvider host={props.props.host}>{props.children}</WorkbenchHostProvider>
    </FixtureTablesContext.Provider>
)
