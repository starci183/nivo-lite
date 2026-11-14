import { ConnectionGrantsBand, type ConnectionGrantsBandProps } from "@/components/frames/ConnectionGrantsBand"

/** The words, the read and the commands of the agents band of a connection. */
export interface ConnectionAgentsBaseProps {
    readonly props: ConnectionGrantsBandProps["props"]
    readonly on: ConnectionGrantsBandProps["on"]
}

/** Draws the agents bound to one connection, the command that unbinds each, and the control that binds another agent. */
export const ConnectionAgentsBase = (props: ConnectionAgentsBaseProps) => (
    <ConnectionGrantsBand props={props.props} on={props.on} />
)
