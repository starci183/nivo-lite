import { blocks } from "@/modules/plugin-registry/client"
import type { ReactNode } from "react"
import { useFixtureTables, useFixtureWorkbenchHost } from "@/hooks/workbenchFixtureHost"
import { PROTOTYPE_INSTALLATION } from "@/modules/workbench-installation"
import { WorkbenchPrototypeLayoutBase } from "./component"

/** What the layout wraps. */
type WorkbenchPrototypeLayoutProps = { readonly children: ReactNode }

/** The prototype host of the workbench renderer: every spec block reads and acts on fixtures. Mounted only when the build is a prototype. */
export const WorkbenchPrototypeLayout = (props: WorkbenchPrototypeLayoutProps) => (
    <WorkbenchPrototypeLayoutBase
        props={{
            host: useFixtureWorkbenchHost(),
            blocks,
            enabled: PROTOTYPE_INSTALLATION.enabled,
            fixtures: useFixtureTables(),
        }}
    >
        {props.children}
    </WorkbenchPrototypeLayoutBase>
)
