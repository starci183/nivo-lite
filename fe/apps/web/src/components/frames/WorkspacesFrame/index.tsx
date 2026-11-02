import type { ReactNode } from "react"
import { Cluster, WorkspaceShell } from "@starci/grammar/common"
import { BAR_CLASS_NAME } from "./classNames"

/** What the workspaces frame draws around a page. */
type WorkspacesFrameProps = {
    /** The accessible name of the page's main region. */
    readonly mainLabel: string
    readonly logo: ReactNode
    readonly localeSwitch: ReactNode
    /** The account menu, when the person is signed in. */
    readonly account?: ReactNode
    /** The routed page: it draws its own `Page`. */
    readonly children: ReactNode
}

/** The layout frame of the workspaces area (outside the console shell): the bar with logo, language switch and account menu over the routed page. */
export const WorkspacesFrame = (props: WorkspacesFrameProps) => (
    <WorkspaceShell
        header={
            <div className={BAR_CLASS_NAME}>
                <Cluster gap="section" justify="between" wrap={false}>
                    {props.logo}
                    <Cluster gap="row" wrap={false}>
                        {props.localeSwitch}
                        {props.account}
                    </Cluster>
                </Cluster>
            </div>
        }
        primaryLabel={props.mainLabel}
        primary={props.children}
    />
)
