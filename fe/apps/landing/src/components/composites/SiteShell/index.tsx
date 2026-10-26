import type { ReactNode } from "react"
import { TopBar, WorkspaceShell } from "@starci/grammar/common"

/** The slots of the public site chrome and the page it frames. */
interface SiteShellProps {
    /** The name of the page's main region. */
    readonly mainLabel: string
    /** The anchor id of the main region, for a "back to top" link. */
    readonly mainId?: string
    /** The logo link at the start of the bar. */
    readonly brand: ReactNode
    /** The in-page links of the bar. */
    readonly navigation: ReactNode
    /** The controls at the end of the bar. */
    readonly actions: ReactNode
    /** The page content. */
    readonly children: ReactNode
}

/** The public site chrome: a sticky top bar over a flowing page, no sidebar and no console shell. */
export const SiteShell = (props: SiteShellProps) => (
    <WorkspaceShell
        viewport="flow"
        header={<TopBar position="sticky" brand={props.brand} navigation={props.navigation} actions={props.actions} />}
        primaryLabel={props.mainLabel}
        {...(props.mainId === undefined ? {} : { primaryId: props.mainId })}
        primary={props.children}
    />
)
