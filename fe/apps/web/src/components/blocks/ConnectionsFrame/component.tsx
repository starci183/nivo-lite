import {
    Alert,
    Badge,
    Page,
    Pane,
    PaneGrid,
    Stack,
    type BreadcrumbItem,
    type ListBoxItem,
    type PageHeaderTabs,
} from "@starci/grammar/common"
import type { ReactNode } from "react"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { ProviderLogo } from "@/components/branches/ProviderLogo"
import { PaneBody } from "@/components/frames/PaneBody"
import { PaneList } from "@/components/frames/PaneList"
import type { FilterGroupChoice, FilterGroupSearch } from "@/components/composites/FilterGroup"
import type { ConnectionListRow, ConnectionsListView, DataSlot, PaneGridLayout, SlotLabels } from "@/modules/types"
import { PHONE_ONLY_CLASS_NAME } from "./classNames"

/** The words and the state of the frame: the page band, the list pane and its notices. */
export interface ConnectionsFrameBaseProps {
    /** The routed page: the overview, a connection's page, or the library. */
    readonly children: ReactNode
    readonly props: {
        readonly copy: {
            readonly grid: string
            readonly listLabel: string
            readonly title: string
            readonly crumbLabel: string
            readonly tabsLabel: string
            readonly tabLibrary: string
            readonly errorBody: string
            readonly noMatchTitle: string
            readonly noMatchBody: string
            readonly clearFilters: string
        }
        readonly crumbs: ReadonlyArray<BreadcrumbItem>
        readonly tab: "connected" | "library"
        /** The Connected tab's label with the count once the read is in. */
        readonly connectedLabel: string
        /** Where each tab goes: the views are routes of the segment, so the tabs are links. */
        readonly tabHrefs: { readonly connected: string; readonly library: string }
        readonly slot: DataSlot<ConnectionsListView>
        readonly labels: SlotLabels
        readonly search: FilterGroupSearch
        readonly choice: Omit<FilterGroupChoice, "options">
        /** The rows the search and the filter leave. */
        readonly rows: ReadonlyArray<ConnectionListRow>
        readonly openId: string | null
        /** A connection page is open: a phone shows it alone, without the page band. */
        readonly isRecordOpen: boolean
        /** The areas and tracks of the pane grid, for the pane a phone shows. */
        readonly grid: PaneGridLayout
    }
    readonly on: {
        readonly open: (row: ConnectionListRow) => void
        readonly retry: () => void
        readonly continueSetup: (href: string) => void
        readonly clearFilters: () => void
    }
}

/** Five rows of the geometry of a ready list: the skeleton keeps the logo, the two lines and the chip. */
const PLACEHOLDER: ConnectionsListView = {
    rows: ["a", "b", "c", "d", "e"].map((id) => ({
        id,
        name: "",
        description: "",
        logo: { isWordmark: false },
        status: { label: "", tone: "neutral" as const, isDot: false },
        href: null,
        groups: [],
    })),
    filters: [],
    summary: "",
    liveCount: 1,
    attention: null,
}

/** The list rows: the provider's mark, the name over what identifies it, and the status chip at the end. */
const itemsOf = (rows: ReadonlyArray<ConnectionListRow>): ReadonlyArray<ListBoxItem> =>
    rows.map((row) => ({
        id: row.id,
        label: row.name,
        description: row.description,
        descriptionLines: 1 as const,
        leading: <ProviderLogo {...row.logo} glyph="email" />,
        trailing: (
            <Badge tone={row.status.tone} isDot={row.status.isDot}>
                {row.status.label}
            </Badge>
        ),
    }))

type Props = ConnectionsFrameBaseProps

/** What the notice reads: the list view that names the connection, and the command that opens its page. */
interface NextNoticeProps extends Props {
    readonly view: ConnectionsListView
}

/** The notice of the connection that needs the owner, above the list on a phone. */
const NextNotice = (props: NextNoticeProps) => {
    const next = props.view.attention
    if (next === null) return null
    const action = next.action
    return (
        <div className={PHONE_ONLY_CLASS_NAME}>
            <Alert
                tone="cautionary"
                title={next.title}
                description={next.body}
                {...(action === null
                    ? {}
                    : { action: { label: action.label, onAction: () => props.on.continueSetup(action.href) } })}
            />
        </div>
    )
}

/** The list through the slot's one status recipe: skeleton, failure band with its retry, rows. */
const ListBody = (props: Props) => {
    const { copy } = props.props
    return (
        <SlotView
            slot={props.props.slot}
            placeholder={PLACEHOLDER}
            labels={props.props.labels}
            errorDescription={copy.errorBody}
            onRetry={props.on.retry}
            render={(view, isLoading) => (
                <Stack gap="row">
                    <NextNotice {...props} view={view} />
                    <PaneList
                        label={copy.listLabel}
                        search={props.props.search}
                        choice={{ ...props.props.choice, options: view.filters }}
                        items={itemsOf(props.props.rows)}
                        selectedId={props.props.openId}
                        onSelect={(id) => {
                            const row = props.props.rows.find((candidate) => candidate.id === id)
                            if (row !== undefined) props.on.open(row)
                        }}
                        empty={{
                            message: copy.noMatchTitle,
                            description: copy.noMatchBody,
                            actionLabel: copy.clearFilters,
                            onAction: props.on.clearFilters,
                        }}
                        isLoading={isLoading}
                    />
                </Stack>
            )}
        />
    )
}

/** The ready list is empty: the page invites the library alone, with no list pane beside it. */
const isEmptyList = (slot: DataSlot<ConnectionsListView>): boolean =>
    "isForbidden" in slot || ("items" in slot && slot.items.liveCount === 0)

/**
 * Draws the Connections frame: the page band (trail, title, summary, the Connected and Library tabs) over a pane grid of the list of
 * connections beside the routed page. The Library tab is a page of cards on the page ground. A workspace with no connection yet
 * shows the routed page alone, which invites the library. A phone shows the list at the root and the open connection elsewhere.
 */
export const ConnectionsFrameBase = (props: ConnectionsFrameBaseProps) => {
    const { copy, slot } = props.props
    const view = "items" in slot ? slot.items : undefined
    const tabs: PageHeaderTabs = {
        label: copy.tabsLabel,
        selectedKey: props.props.tab,
        items: [
            { id: "connected", label: props.props.connectedLabel, href: props.props.tabHrefs.connected },
            { id: "library", label: copy.tabLibrary, href: props.props.tabHrefs.library },
        ],
    }
    const header = {
        breadcrumbs: { label: copy.crumbLabel, items: [...props.props.crumbs] },
        title: copy.title,
        meta: view?.summary ?? copy.title,
        tabs,
    }
    if (props.props.tab === "library") {
        return (
            <Page header={header} measure="product" isLoading={view === undefined}>
                {props.children}
            </Page>
        )
    }
    const { grid } = props.props
    return (
        <Page
            chrome="panes"
            header={header}
            measure="product"
            isLoading={view === undefined}
            {...(props.props.isRecordOpen ? { headerCollapse: "narrow" as const } : {})}
        >
            <PaneGrid label={copy.grid} areas={grid.areas} columns={grid.columns} rows={grid.rows}>
                {isEmptyList(slot) ? null : (
                    <Pane area="list" surface scroll label={copy.listLabel}>
                        <PaneBody>
                            <ListBody {...props} />
                        </PaneBody>
                    </Pane>
                )}
                <Pane area="content" inset="flush">
                    {props.children}
                </Pane>
            </PaneGrid>
        </Page>
    )
}
