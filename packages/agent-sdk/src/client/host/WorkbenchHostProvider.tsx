import { createContext, useContext } from "react"
import type { ReactNode } from "react"
import type { BlockHost } from "../../block/block.types"
import type { WorkbenchHost } from "../../host/host.types"

const HostContext = createContext<WorkbenchHost | null>(null)

/** What the provider takes. */
export interface WorkbenchHostProviderProps {
    readonly host: WorkbenchHost
    readonly children: ReactNode
}

/** Mounts the host once; the renderer and every block reach their ports through it. */
export const WorkbenchHostProvider = (props: WorkbenchHostProviderProps): ReactNode => (
    <HostContext.Provider value={props.host}>{props.children}</HostContext.Provider>
)

/** The host of the nearest provider; throws when none is mounted, which is a wiring defect. */
export const useWorkbenchHost = (): WorkbenchHost => {
    const host = useContext(HostContext)
    if (host === null) throw new RangeError("WorkbenchHostProvider is not mounted")
    return host
}

/** The ports a block may use. */
export const useBlockHost = (): BlockHost => useWorkbenchHost().block
