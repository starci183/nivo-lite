import type { ReactNode } from "react"
import type { ActionDefinition, ActionHandle } from "../../block/block.types"
import { useWorkbenchHost } from "../host/WorkbenchHostProvider"

/** What a bound action takes. */
export interface BoundActionProps {
    readonly action: ActionDefinition
    readonly namespace: string
    readonly children: (handle: ActionHandle) => ReactNode
}

/** One action of one node: the host command, whether the viewer may run it, and its label in the viewer words. */
export const BoundAction = (props: BoundActionProps): ReactNode => {
    const host = useWorkbenchHost()
    const isAllowed = host.useCan(props.action.permission)
    const action = host.useAction(props.action.operation)
    return props.children({
        run: action.run,
        isAllowed,
        isRunning: action.isRunning,
        label: host.block.text(props.namespace)(props.action.label),
    })
}
