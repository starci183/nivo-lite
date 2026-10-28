import { PageContainer } from "@starci/grammar/common"
import type { ReactNode } from "react"
import { ConnectionsHead } from "@/components/composites/ConnectionsHead"
import { connectionsPageClassNames as classNames } from "./classNames"
import { ConnectionsBoardRegion } from "./component"
import type { ConnectionsOverviewProps } from "./component"

export type { ConnectionsBoard } from "./component"

/**
 * The Connections page: the trail and heading, then the board read from the workspace: the first connection that needs attention, the
 * Connected / Library tabs, and either the library or the provider lists grouped by what they bring in. The feature host reads the
 * workspace and registers the blocks the board draws (a block never imports a block), so this unit draws what it is handed.
 */
export const ConnectionsOverview = (props: ConnectionsOverviewProps) => {
    const { words, summary } = props.props
    return (
        <PageContainer measure="product">
            <div className={classNames.page}>
                <ConnectionsHead
                    crumbLabel={words.crumbLabel}
                    homeLabel={words.crumbHome}
                    homeHref={words.homeHref}
                    title={words.title}
                    addLabel={words.addLabel}
                    addHref={words.addHref}
                    description={words.description}
                    {...(summary === null ? {} : { meta: summary })}
                />
                <ConnectionsBoardRegion overview={props} />
            </div>
        </PageContainer>
    )
}

/** The feature host supplies the registered drawers and their readiness. */
interface OverlayHostProps {
    readonly active: boolean
    readonly candidate: ReactNode
}

/** A pure host for the connection drawers; the feature owns their registration and lifecycle. */
export const OverlayHost = (props: OverlayHostProps) => <>{props.active ? props.candidate : null}</>
