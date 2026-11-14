import { blocks } from "@/modules/plugin-registry/client"
import type { ReactNode } from "react"
import { useGraphqlWorkbenchHost } from "@/hooks/workbenchHost"
import { useLiveInstallation } from "@/hooks/workbenchInstallation"
import { WorkbenchHostLayoutBase } from "./component"

/** What the layout wraps. */
type WorkbenchHostLayoutProps = { readonly children: ReactNode }

/** The live host of the workbench renderer: every spec block reads and acts through the back end generic operations. */
export const WorkbenchHostLayout = (props: WorkbenchHostLayoutProps) => {
    const installation = useLiveInstallation()
    return (
        <WorkbenchHostLayoutBase
            props={{
                host: useGraphqlWorkbenchHost(),
                blocks,
                enabled: installation.enabled,
                registry: installation.registry,
            }}
        >
            {props.children}
        </WorkbenchHostLayoutBase>
    )
}
