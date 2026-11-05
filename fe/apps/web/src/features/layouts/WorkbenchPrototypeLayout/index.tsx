import { MODULE_FIXTURES } from "@nivo-lite/blocks-core/fixtures"
import { blocks } from "@nivo-lite/plugin-registry/client"
import type { ReactNode } from "react"
import { useFixtureWorkbenchHost } from "@/hooks/workbenchFixtureHost"
import { fixtureTablesOf } from "@/modules/workbench-fixtures"
import { PROTOTYPE_INSTALLATION, PROTOTYPE_INSTALLATION_ID } from "@/modules/workbench-installation"
import { WorkbenchPrototypeLayoutBase } from "./component"

/** What the layout wraps. */
type WorkbenchPrototypeLayoutProps = { readonly children: ReactNode }

/** The fixtures of every module, joined once. */
const FIXTURES = fixtureTablesOf(MODULE_FIXTURES)

/** The prototype host of the workbench renderer: every spec block reads and acts on fixtures. Mounted only when the build is a prototype. */
export const WorkbenchPrototypeLayout = (props: WorkbenchPrototypeLayoutProps) => (
    <WorkbenchPrototypeLayoutBase
        props={{
            host: useFixtureWorkbenchHost(),
            blocks,
            enabled: PROTOTYPE_INSTALLATION.enabled,
            fixtures: FIXTURES,
            installationId: PROTOTYPE_INSTALLATION_ID,
        }}
    >
        {props.children}
    </WorkbenchPrototypeLayoutBase>
)
