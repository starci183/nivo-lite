import { Button, Cluster, Pane, PaneGrid, Page, SurfaceCard, Text } from "@starci/grammar/common"
import type { PageHeaderBreadcrumbs } from "@starci/grammar/common"
import { InboxAside } from "@/components/composites/InboxAside"
import { InboxApprovalCard } from "@/components/composites/InboxApprovalCard"
import { InboxJourneyCard } from "@/components/composites/InboxJourneyCard"
import { InboxLeadHead } from "@/components/composites/InboxLeadHead"
import { LeadFreeze } from "@/components/blocks/LeadFreeze"
import { InboxLeadList } from "@/components/composites/InboxLeadList"
import { InboxNeedsCard } from "@/components/composites/InboxNeedsCard"
import { PaneBlank } from "@/components/composites/PaneBlank"
import { InboxWebsiteDrawer } from "@/components/frames/InboxWebsiteDrawer"
import { PaneBody } from "@/components/frames/PaneBody"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { InboxCopy } from "@/modules/inbox"
import type {
    InboxDetailView,
    InboxListView,
    InboxOptionView,
    InboxReadStatus,
    InboxWebsiteView,
    PaneGridLayout,
} from "@/modules/types"

/** Props for {@link InboxFeedBase}. */
export interface InboxFeedBaseProps {
    readonly props: {
        /** The trail: the dashboard, then the inbox. */
        readonly breadcrumbs: PageHeaderBreadcrumbs
        readonly copy: InboxCopy
        /** The words every list and detail frame shares. */
        readonly pane: {
            readonly back: string
            readonly refresh: string
            readonly retry: string
            readonly clearSearch: string
            readonly moreFilters: string
            readonly closeAside: string
        }
        /** The areas and tracks of the pane grid, for the pane the phone shows. */
        readonly grid: PaneGridLayout
        /** The pane a phone shows: the list, or the opened customer (its way back stands in the head card). */
        readonly phone: "list" | "main"
        /** The drawer of the customer's facts is open (below the wide width the facts are a drawer). */
        readonly isAsideOpen: boolean
        readonly list: InboxListView
        readonly listStatus: InboxReadStatus
        /** The opened customer, or null while it loads or when nothing is open. */
        readonly detail: InboxDetailView | null
        readonly detailStatus: InboxReadStatus
        /** The agents a customer can be handed to. */
        readonly agents: ReadonlyArray<InboxOptionView>
        readonly isDeciding: boolean
        readonly decisionFailed: boolean
        /** Which journey entries show: all, message or agent. */
        readonly journeyFilter: string
        readonly website: InboxWebsiteView
        readonly websiteFailed: boolean
    }
    readonly on: {
        readonly setTab: (id: string) => void
        readonly setQuery: (value: string) => void
        readonly setChannel: (id: string) => void
        readonly setAgent: (id: string) => void
        readonly setSort: (id: string) => void
        readonly select: (id: string) => void
        readonly back: () => void
        readonly openAside: () => void
        readonly closeAside: () => void
        readonly refresh: () => void
        readonly openConnections: () => void
        readonly assign: (leadId: string, agentId: string | null) => void
        readonly message: () => void
        readonly copy: (text: string) => void
        readonly approve: (orderId: string) => void
        readonly reject: (orderId: string) => void
        readonly edit: () => void
        readonly setJourneyFilter: (id: string) => void
        readonly website: {
            readonly open: () => void
            readonly close: () => void
            readonly selectTab: (id: string) => void
            readonly setChat: (on: boolean) => void
            readonly setForm: (on: boolean) => void
            readonly setPrices: (on: boolean) => void
            readonly setAgent: (id: string) => void
            readonly save: () => void
        }
    }
}

type Props = InboxFeedBaseProps

/** The two commands of the page header: connect the website (what it is: a globe), and open the connections (where it leads: an arrow). */
const HeaderActions = (props: Props) => (
    <Cluster gap="inline">
        <Button
            intent="alternative"
            onPress={props.on.website.open}
        >
            {props.props.copy.actionWebsite}
        </Button>
        <Button endArrow intent="alternative" onPress={props.on.openConnections}>
            {props.props.copy.actionConnections}
        </Button>
    </Cluster>
)

/** The drawer of the website form: a modal the main pane hosts, so the route stays one `Page` with one grid. */
const WebsiteOverlay = (props: Props) => (
    <InboxWebsiteDrawer
        props={{ copy: props.props.copy, view: props.props.website, failed: props.props.websiteFailed }}
        on={{ ...props.on.website, copy: props.on.copy, openConnections: props.on.openConnections }}
    />
)

/** The cards under the head while the customer loads: their labels stay real and their bodies are shapes. */
const DetailSkeleton = (props: Props) => (
    <PaneBody isWaiting overlay={<WebsiteOverlay {...props} />}>
        <SurfaceCard ariaLabel={props.props.copy.detailLabel} isLoading>
            <Text>{""}</Text>
        </SurfaceCard>
        <SurfaceCard label={props.props.copy.needsTitle} isLoading>
            <Text>{""}</Text>
        </SurfaceCard>
        <SurfaceCard label={props.props.copy.journeyTitle} isLoading>
            <Text>{""}</Text>
        </SurfaceCard>
    </PaneBody>
)

/** The cards of the opened customer: what waits for the owner, what the customer needs, and the journey. */
const DetailBody = (props: Props & { readonly detail: InboxDetailView }) => {
    const { copy } = props.props
    const { detail } = props
    return (
        <PaneBody overlay={<WebsiteOverlay {...props} />}>
            <InboxLeadHead
                props={{ copy, detail, agents: props.props.agents, back: props.props.pane.back }}
                on={{
                    assign: props.on.assign,
                    message: props.on.message,
                    copyPhone: props.on.copy,
                    back: props.on.back,
                    openAside: props.on.openAside,
                }}
            />
            <LeadFreeze leadId={detail.id} />
            {detail.approval === null ? null : (
                <InboxApprovalCard
                    props={{
                        copy,
                        approval: detail.approval,
                        isDeciding: props.props.isDeciding,
                        failed: props.props.decisionFailed,
                    }}
                    on={{ approve: props.on.approve, reject: props.on.reject, edit: props.on.edit }}
                />
            )}
            <InboxNeedsCard props={{ copy, detail }} />
            <InboxJourneyCard
                props={{ copy, detail, filter: props.props.journeyFilter }}
                on={{ setFilter: props.on.setJourneyFilter }}
            />
        </PaneBody>
    )
}

/** The main pane: the cards of the opened customer, their shapes while it loads, a notice when it failed or nothing is open. */
const MainBody = (props: Props) => {
    const { copy, detail, detailStatus, list } = props.props
    if (list.selectedId === null || detailStatus === "failed") {
        return (
            <PaneBlank
                message={detailStatus === "failed" ? copy.detailErrorTitle : copy.pickTitle}
                description={detailStatus === "failed" ? copy.errorBody : copy.pickBody}
                iconSource={nivoIconSource(detailStatus === "failed" ? "warning" : "email", "leading")}
                frame="frameless"
                overlay={<WebsiteOverlay {...props} />}
            />
        )
    }
    if (detail === null) return <DetailSkeleton {...props} />
    return <DetailBody {...props} detail={detail} />
}

/** The side pane: the facts of the opened customer, a white column at the wide width and a drawer below it. */
const asidePane = (props: Props) => {
    const { copy, detail, pane, isAsideOpen } = props.props
    return (
        <Pane
            area="aside"
            surface
            scroll
            label={copy.asideLabel}
            collapse="drawer"
            trigger="none"
            collapseLabel={copy.asideLabel}
            closeLabel={pane.closeAside}
            isOpen={isAsideOpen}
            onOpenChange={(isOpen) => (isOpen ? props.on.openAside() : props.on.closeAside())}
        >
            <PaneBody>{detail === null ? null : <InboxAside props={{ copy, detail }} />}</PaneBody>
        </Pane>
    )
}

/**
 * Draws the Inbox as a workspace: the header band with the title, the summary line and the two commands; the customers in a white column
 * (tabs, search with its icon filters, rows); the opened customer's cards stacked on the pink well (its head card, what waits for the
 * owner, what the customer needs, the journey); and the facts of the customer in a white column that is a drawer below the wide width.
 * With no customer open the well shows a notice and there is no side pane. A phone shows the list, or the opened customer alone.
 */
export const InboxFeedBase = (props: InboxFeedBaseProps) => {
    const view = props.props
    const { copy, pane } = view
    const isLoading = view.listStatus === "loading"
    const hasDetail = view.list.selectedId !== null
    return (
        <Page
            layout="workspace"
            chrome="panes"
            {...(hasDetail && view.phone === "main" ? { headerCollapse: "narrow" as const } : {})}
            header={{
                breadcrumbs: view.breadcrumbs,
                title: copy.title,
                meta: view.list.stats.join(" · "),
                actions: <HeaderActions {...props} />,
            }}
        >
            <PaneGrid label={copy.gridLabel} areas={view.grid.areas} columns={view.grid.columns} rows={view.grid.rows}>
                <Pane area="list" surface label={copy.listLabel}>
                    <InboxLeadList
                        props={{ copy, list: view.list, pane, isLoading, isFailed: view.listStatus === "failed" }}
                        on={{
                            setTab: props.on.setTab,
                            setQuery: props.on.setQuery,
                            setChannel: props.on.setChannel,
                            setAgent: props.on.setAgent,
                            setSort: props.on.setSort,
                            select: props.on.select,
                            refresh: props.on.refresh,
                            openConnections: props.on.openConnections,
                        }}
                    />
                </Pane>
                <Pane area="main" scroll label={copy.detailLabel}>
                    <MainBody {...props} />
                </Pane>
                {hasDetail ? asidePane(props) : null}
            </PaneGrid>
        </Page>
    )
}
