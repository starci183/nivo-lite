import type { ReactNode } from "react"
import { Link, PageContainer, WorkspaceShell } from "@starci/grammar/common"
import { FRAME_CLASS_NAME, HEADER_CLASS_NAME, TOP_CLASS_NAME, TOP_END_CLASS_NAME } from "./classNames"

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
    readonly children: ReactNode
}

/** The page frame of the workspaces area (outside the console shell): logo, language switch and account menu over the page. */
export const WorkspacesFrame = (props: WorkspacesFrameProps) => (
    <WorkspaceShell
        header={
            <PageContainer measure="product">
                <div className={HEADER_CLASS_NAME}>
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
            </PageContainer>
        }
        primaryLabel={props.mainLabel}
        primary={
            <PageContainer measure="product">
                <div className={FRAME_CLASS_NAME}>{props.children}</div>
            </PageContainer>
        }
    />
)
