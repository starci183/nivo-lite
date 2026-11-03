import { createContext, useContext } from "react"
import type { ReactNode } from "react"
import type { WorkbenchHost } from "./host.types"

/** The host of the workbenches below; null outside a provider. */
const WorkbenchHostContext = createContext<WorkbenchHost | null>(null)

/** What the provider takes: the host's port bindings and the tree that reaches them. */
export interface WorkbenchHostProviderProps {
    readonly host: WorkbenchHost
    readonly children: ReactNode
}

/** Gives every module workbench below the one host; the app mounts it once around the workbench route. */
export const WorkbenchHostProvider = (props: WorkbenchHostProviderProps): ReactNode => (
    <WorkbenchHostContext.Provider value={props.host}>{props.children}</WorkbenchHostContext.Provider>
)

/** The host of the current workbench; a module hook calls its ports. Throws outside a provider, a wiring bug. */
export const useWorkbenchHost = (): WorkbenchHost => {
    const host = useContext(WorkbenchHostContext)
    if (host === null) throw new Error("WORKBENCH_HOST_MISSING: mount WorkbenchHostProvider around the workbench route")
    return host
}
