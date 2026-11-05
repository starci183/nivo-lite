import type { ReactNode } from "react"
import { useGraphqlWorkbenchHost } from "@/hooks/workbenchHost"
import { WorkbenchHostLayoutBase } from "./component"

/** What the layout wraps. */
type WorkbenchHostLayoutProps = { readonly children: ReactNode }

/** The live host of the workbench renderer: every spec block reads and acts through the back end generic operations. */
export const WorkbenchHostLayout = (props: WorkbenchHostLayoutProps) => (
    <WorkbenchHostLayoutBase props={{ host: useGraphqlWorkbenchHost() }}>{props.children}</WorkbenchHostLayoutBase>
)
