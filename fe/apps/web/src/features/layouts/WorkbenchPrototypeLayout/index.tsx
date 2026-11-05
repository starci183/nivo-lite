import type { ReactNode } from "react"
import { useFixtureWorkbenchHost } from "@/hooks/workbenchFixtureHost"
import { WorkbenchPrototypeLayoutBase } from "./component"

/** What the layout wraps. */
type WorkbenchPrototypeLayoutProps = { readonly children: ReactNode }

/** The prototype host of the workbench renderer: every spec block reads and acts on fixtures. Mounted only when the build is a prototype. */
export const WorkbenchPrototypeLayout = (props: WorkbenchPrototypeLayoutProps) => (
    <WorkbenchPrototypeLayoutBase props={{ host: useFixtureWorkbenchHost() }}>
        {props.children}
    </WorkbenchPrototypeLayoutBase>
)
