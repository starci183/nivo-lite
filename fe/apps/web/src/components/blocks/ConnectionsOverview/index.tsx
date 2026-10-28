import { Page } from "@starci/grammar/common"
import type { ReactNode } from "react"
import { ConnectionsHeadContent } from "@/components/composites/ConnectionsHead"
import { connectionsPageClassNames as classNames } from "./classNames"
import { ConnectionsBoardRegion } from "./component"
import type { ConnectionsOverviewProps } from "./component"

export type { ConnectionsBoard } from "./component"

/**
 * The Connections page: one `Page` whose header holds the trail, heading, summary, the add command and the Connected / Library tabs,
 * and whose body holds the board read from the workspace (the first connection that needs attention, and either the library or the
 * provider lists grouped by what they bring in) with the MCP gateway sections under it. The feature host reads the workspace and
 * registers the blocks the board draws (a block never imports a block), so this unit draws what it is handed.
 */
export const ConnectionsOverview = (props: ConnectionsOverviewProps) => {
    const { words, summary, board, placeholderView, tabs } = props.props
    const ready = board.items
    return (
        <Page
            header={ConnectionsHeadContent({
                crumbLabel: words.crumbLabel,
                homeLabel: words.crumbHome,
                homeHref: words.homeHref,
                title: words.title,
                addLabel: words.addLabel,
                addHref: words.addHref,
                description: words.description,
                ...(summary === null ? {} : { meta: summary }),
                tabs: {
                    label: tabs.label,
                    selectedKey: ready?.view ?? placeholderView,
                    onSelect: (key) => props.on.selectTab(key === "library" ? "library" : "connected"),
                    items: [
                        {
                            id: "connected",
                            label:
                                ready === undefined
                                    ? tabs.connectedLabel
                                    : `${tabs.connectedLabel} · ${ready.liveCount}`,
                        },
                        { id: "library", label: tabs.libraryLabel },
                    ],
                },
            })}
            measure="product"
        >
            <div className={classNames.page}>
                <ConnectionsBoardRegion overview={props} />
                {props.props.gateway}
            </div>
        </Page>
    )
}

/** The feature host supplies the registered drawers and their readiness. */
interface OverlayHostProps {
    readonly active: boolean
    readonly candidate: ReactNode
}

/** A pure host for the connection drawers; the feature owns their registration and lifecycle. */
export const OverlayHost = (props: OverlayHostProps) => <>{props.active ? props.candidate : null}</>
