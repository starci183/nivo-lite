import type { ReactNode } from "react"
import { Link, WorkspaceShell } from "@starci/grammar/common"
import { BAR_CLASS_NAME, TOP_CLASS_NAME, TOP_END_CLASS_NAME } from "./classNames"

/** What the workspaces frame draws around a page. */
type WorkspacesFrameProps = {
    /** Where the logo leads. */
    readonly homeHref: string
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
                <div className={TOP_CLASS_NAME}>
                    <Link href={props.homeHref} visited="uniform">
                        {props.logo}
                    </Link>
                    <div className={TOP_END_CLASS_NAME}>
                        {props.localeSwitch}
                        {props.account}
                    </div>
                </div>
            </div>
        }
        primaryLabel={props.mainLabel}
        primary={props.children}
    />
)
