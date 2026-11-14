import { AgentInstances } from "@/components/blocks/AgentInstances"
import type { ModuleKey } from "@/modules/catalog"

/** The instances of one agent type. */
export interface AgentTypePageBaseProps {
    readonly props: {
        /** The type of the url; none on the loading route, whose block reads the address. */
        readonly module: ModuleKey | undefined
        readonly query: string
        readonly showList: boolean
    }
}

/** Draws the list of the instances of an agent type. */
export const AgentTypePageBase = (props: AgentTypePageBaseProps) => (
    <AgentInstances module={props.props.module} query={props.props.query} showList={props.props.showList} />
)
