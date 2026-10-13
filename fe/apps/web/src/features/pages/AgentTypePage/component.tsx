import type { ComponentProps } from "react"
import { InstanceList } from "@/features/agent-instances/InstanceList"

/** The instances of one agent type. */
export interface AgentTypePageBaseProps {
    readonly props: ComponentProps<typeof InstanceList>
}

/** Draws the list of the instances of an agent type. */
export const AgentTypePageBase = (props: AgentTypePageBaseProps) => <InstanceList {...props.props} />
