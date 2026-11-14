import { GuideTarget } from "@/components/leaves/GuideTarget"
import { Button, Page, type PageHeaderBreadcrumbs, type PageHeaderTabs } from "@starci/grammar/common"
import type { ReactNode } from "react"

/** The words and the state of the Connections page band. */
export interface ConnectionsFrameBaseProps {
    /** The tab's page: the list of connections, or the library. */
    readonly children?: ReactNode
    readonly props: {
        /** The trail: the dashboard, then Connections. */
        readonly breadcrumbs: PageHeaderBreadcrumbs
        readonly copy: {
            readonly title: string
            readonly tabsLabel: string
            readonly addLabel: string
        }
        readonly tab: "connected" | "library"
        /** The line under the title: what runs, what waits, what needs the owner. */
        readonly summary: string
        /** The tabs' names, and the counts the chips show once the read is in (undefined while unknown). */
        readonly connectedLabel: string
        readonly libraryLabel: string
        /** The library's categories, the second layer of tabs in the band (only on the library tab). */
        readonly categories: PageHeaderTabs | null
        readonly connectedCount: number | undefined
        readonly libraryCount: number | undefined
        /** Where each tab goes: the views are addresses of the page, so the tabs are links. */
        readonly tabHrefs: { readonly connected: string; readonly library: string }
        /** "Add connection" belongs to the owner; it opens the library. */
        readonly canAdd: boolean
        readonly isLoading: boolean
    }
}

/**
 * Draws the Connections page: one full-width page whose band holds the title, the summary line, "Add connection" and the two tabs
 * (Connected, Library); the tab's page fills the well under it.
 */
export const ConnectionsFrameBase = (props: ConnectionsFrameBaseProps) => {
    const { copy } = props.props
    const tabs: PageHeaderTabs = {
        label: copy.tabsLabel,
        selectedKey: props.props.tab,
        items: [
            {
                id: "connected",
                label: props.props.connectedLabel,
                href: props.props.tabHrefs.connected,
                ...(props.props.connectedCount === undefined ? {} : { count: props.props.connectedCount }),
            },
            {
                id: "library",
                label: props.props.libraryLabel,
                href: props.props.tabHrefs.library,
                ...(props.props.libraryCount === undefined ? {} : { count: props.props.libraryCount }),
            },
        ],
    }
    return (
        <Page
            header={{
                breadcrumbs: props.props.breadcrumbs,
                title: copy.title,
                meta: props.props.summary,
                tabs,
                ...(props.props.tab === "library" && props.props.categories !== null
                    ? { subTabs: props.props.categories }
                    : {}),
                ...(props.props.canAdd
                    ? {
                          actions: (
                              <GuideTarget id="connections.add">
                                  <Button startGlyph="plus" intent="commit" href={props.props.tabHrefs.library}>
                                      {copy.addLabel}
                                  </Button>
                              </GuideTarget>
                          ),
                      }
                    : {}),
            }}
            measure="product"
            isLoading={props.props.isLoading}
        >
            {props.children}
        </Page>
    )
}
