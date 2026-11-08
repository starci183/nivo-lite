import { WorkbenchHostProvider, type BlockRenderer, type WorkbenchHost } from "@nivo-lite/agent-sdk/client"
import type { ReactNode } from "react"
import { FixtureTablesContext, type FixtureTables } from "@/modules/workbench-host"

/** What the pure half takes: the host, the installed blocks, the enabled modules and the fixtures to mount, and what they wrap. */
export interface WorkbenchPrototypeLayoutBaseProps {
    readonly props: {
        readonly host: WorkbenchHost
        readonly blocks: ReadonlyArray<BlockRenderer>
        readonly enabled: ReadonlyArray<string>
        readonly fixtures: FixtureTables
    }
    readonly children: ReactNode
}

/** Mounts the prototype host with the blocks installed in this bundle and the fixtures it answers from; there is no back-end registry to compare with. */
export const WorkbenchPrototypeLayoutBase = (props: WorkbenchPrototypeLayoutBaseProps) => (
    <FixtureTablesContext.Provider value={props.props.fixtures}>
        <WorkbenchHostProvider
            host={props.props.host}
            blocks={props.props.blocks}
            enabled={props.props.enabled}
            registry={null}
        >
            {props.children}
        </WorkbenchHostProvider>
    </FixtureTablesContext.Provider>
)
