import { Page, Pane, PaneGrid } from "@starci/grammar/common"
import type { ListBoxItem } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { PaneBlank } from "@/components/composites/PaneBlank"
import { PaneHead } from "@/components/composites/PaneHead"
import type { PanePrimary } from "@/components/composites/PaneHead"
import { ResponsibilityDetail } from "@/components/composites/ResponsibilityDetail"
import { PaneBody } from "@/components/frames/PaneBody"
import { PaneList } from "@/components/frames/PaneList"
import { RowTrailing } from "@/components/composites/RowTrailing"
import { ResponsibilityListHead } from "@/components/frames/ResponsibilityListHead"
import { ResponsibilityMainHead } from "@/components/frames/ResponsibilityMainHead"
import { nivoIconSource } from "@/components/leaves/Icon"
import { PersonAvatar } from "@/components/leaves/PersonAvatar"
import { leadHref } from "@/modules/routes"
import type {
    DataSlot,
    PaneGridLayout,
    ResponsibilitiesBoardCopy,
    ResponsibilityOpenedView,
    ResponsibilityRowView,
    SlotLabels,
} from "@/modules/types"

/** One choice of a select or one tab, with how many rows it holds once the read settled. */
export type ResponsibilityChoiceView = { readonly id: string; readonly label: string; readonly count?: number }

/** Copy, values and state of the responsibility board. */
export interface ResponsibilitiesBoardBaseProps {
    readonly props: {
        readonly copy: ResponsibilitiesBoardCopy
        readonly tabs: ReadonlyArray<ResponsibilityChoiceView>
        readonly status: string
        readonly query: string
        readonly owners: ReadonlyArray<ResponsibilityChoiceView>
        readonly owner: string
        readonly dues: ReadonlyArray<ResponsibilityChoiceView>
        readonly due: string
        readonly sorts: ReadonlyArray<ResponsibilityChoiceView>
        readonly sort: string
        readonly isFiltered: boolean
        readonly isFiltersOpen: boolean
        readonly slot: DataSlot<{
            readonly groups: ReadonlyArray<{
                readonly id: string
                readonly label: string
                readonly rows: ReadonlyArray<ResponsibilityOpenedView>
            }>
        }>
        /** The first read has no data yet. */
        readonly isWaiting: boolean
        readonly labels: SlotLabels
        readonly selectedId: string | null
        readonly draftingId: string | null
        readonly copiedId: string | null
        readonly grid: PaneGridLayout
    }
    readonly on: {
        readonly status: (key: string) => void
        readonly query: (value: string) => void
        readonly owner: (value: string | null) => void
        readonly due: (value: string | null) => void
        readonly sort: (value: string | null) => void
        readonly clear: () => void
        readonly filtersOpenChange: (isOpen: boolean) => void
        readonly select: (id: string) => void
        readonly back: () => void
        readonly retry: () => void
        readonly draft: (responsibilityId: string) => void
        readonly copy: (responsibilityId: string, leadId: string) => void
    }
}

type Props = ResponsibilitiesBoardBaseProps

/** One resting row: the skeleton keeps the geometry of the ready list and detail. */
const PLACEHOLDER_ROW: ResponsibilityRowView = {
    id: "",
    leadId: "",
    customer: "",
    title: "",
    nextAction: "",
    dueLabel: "",
    dueAt: null,
    createdAt: "",
    isOverdue: false,
    isDueToday: false,
    isDueThisWeek: false,
    status: "open",
    statusLabel: "",
    ownerKey: "",
    ownerName: "",
    ownerKind: "human",
    ownerHandle: null,
}
const PLACEHOLDER_ROWS: ReadonlyArray<ResponsibilityOpenedView> = ["a", "b", "c", "d", "e"].map((id) => ({
    row: { ...PLACEHOLDER_ROW, id },
    avatarUrl: null,
    ownerRole: "",
    dueDate: null,
    canDraft: false,
}))

/** The list rows: the customer, the next step, and at the end the due words over the state. */
const itemOf = (opened: ResponsibilityOpenedView, nextLabel: (action: string) => string): ListBoxItem => ({
    id: opened.row.id,
    label: opened.row.customer.split(" · ")[0] ?? opened.row.customer,
    description: nextLabel(opened.row.nextAction),
    descriptionLines: 2,
    leading: <PersonAvatar name={opened.row.customer.split(" · ")[0] ?? ""} size="md" />,
    trailing: (
        <RowTrailing
            {...(opened.row.dueLabel === null ? {} : { meta: opened.row.dueLabel })}
            badge={{
                label: opened.row.statusLabel,
                tone: opened.row.status === "waiting_approval" ? "warning" : "neutral",
            }}
        />
    ),
})

/** The opened responsibility: the one chosen (the first when none was), a skeleton row while waiting, none when there is none. */
const openedOf = (view: Props["props"]): ResponsibilityOpenedView | null => {
    if (view.isWaiting) return PLACEHOLDER_ROWS[0] ?? null
    const rows = "items" in view.slot ? view.slot.items.groups.flatMap((group) => group.rows) : []
    return rows.find((opened) => opened.row.id === view.selectedId) ?? null
}

/** The list body: the search and the status filter over the rows, with the notice that fits an empty or a filtered list. */
const ListBody = (props: Props) => {
    const { copy } = props.props
    return (
        <SlotView
            slot={props.props.slot}
            placeholder={{ groups: [{ id: "waiting", label: "", rows: PLACEHOLDER_ROWS }] }}
            labels={props.props.labels}
            errorDescription={copy.errorBody}
            onRetry={props.on.retry}
            render={(list, isLoading) => (
                <PaneList
                    label={copy.listLabel}
                    search={{
                        label: copy.searchLabel,
                        placeholder: copy.searchPlaceholder,
                        clearLabel: copy.clearSearch,
                        value: props.props.query,
                        onChange: props.on.query,
                    }}
                    choice={{
                        label: copy.tabsLabel,
                        options: props.props.tabs.map((tab) => ({
                            value: tab.id,
                            label: tab.label,
                            ...(tab.count === undefined ? {} : { count: tab.count }),
                        })),
                        value: props.props.status,
                        onChange: props.on.status,
                    }}
                    sections={list.groups.map((group) => ({
                        id: group.id,
                        label: group.label,
                        items: group.rows.map((opened) => itemOf(opened, copy.detail.nextOf)),
                    }))}
                    selectedId={props.props.selectedId}
                    onSelect={props.on.select}
                    empty={{
                        message: props.props.labels.empty,
                        description: copy.emptyBody,
                        iconSource: nivoIconSource("filter", "leading"),
                        ...(props.props.isFiltered ? { actionLabel: copy.clearFilters, onAction: props.on.clear } : {}),
                    }}
                    isLoading={isLoading}
                />
            )}
        />
    )
}

/** The one filled command of the opened responsibility: the follow-up draft, when one can be asked for. */
const draftCommandOf = (props: Props, opened: ResponsibilityOpenedView | null): PanePrimary | undefined => {
    if (opened?.canDraft !== true) return undefined
    const isDrafting = props.props.draftingId === opened.row.id
    return {
        label: isDrafting ? props.props.copy.drafting : props.props.copy.draft,
        isPending: isDrafting,
        onPress: () => props.on.draft(opened.row.id),
    }
}

/** The head of the opened responsibility (or of the page while none is open), with the draft command when one can be asked. */
const MainHead = (props: Props) => {
    const view = props.props
    const opened = openedOf(view)
    if (opened === null) {
        return (
            <PaneHead
                title={view.copy.title}
                headingLevel={1}
                description={view.copy.pageBody}
                back={{ label: view.copy.back, onPress: props.on.back }}
            />
        )
    }
    const { row } = opened
    return (
        <ResponsibilityMainHead
            title={row.title}
            customer={row.customer}
            statusLabel={row.statusLabel}
            isWaitingApproval={row.status === "waiting_approval"}
            isLoading={view.isWaiting}
            backLabel={view.copy.back}
            onBack={props.on.back}
            moreLabel={view.copy.moreActions}
            leadHref={leadHref(row.leadId)}
            labels={{
                openLead: view.copy.detail.openLead,
                openOffice: view.copy.detail.openOffice,
                copyLink: view.copy.menuCopy,
            }}
            onCopy={() => props.on.copy(row.id, row.leadId)}
            primary={draftCommandOf(props, opened)}
        />
    )
}

/** Draws the responsibilities as the chat pattern: the list beside the opened responsibility; a phone shows one pane. */
export const ResponsibilitiesBoardBase = (props: ResponsibilitiesBoardBaseProps) => {
    const view = props.props
    const { copy } = view
    const opened = openedOf(view)
    const primary = draftCommandOf(props, opened)
    return (
        <Page chrome="panes">
            <PaneGrid label={copy.grid} areas={view.grid.areas} columns={view.grid.columns} rows={view.grid.rows}>
                <Pane area="listHead" surface>
                    <PaneHead
                        title={copy.title}
                        actions={
                            <ResponsibilityListHead
                                count={copy.count}
                                filtersLabel={copy.filtersLabel}
                                filtersTitle={copy.filtersTitle}
                                isOpen={view.isFiltersOpen}
                                onOpenChange={props.on.filtersOpenChange}
                                filters={{
                                    copy: copy.filters,
                                    owners: view.owners,
                                    owner: view.owner,
                                    dues: view.dues,
                                    due: view.due,
                                    sorts: view.sorts,
                                    sort: view.sort,
                                    onOwner: props.on.owner,
                                    onDue: props.on.due,
                                    onSort: props.on.sort,
                                    onClear: props.on.clear,
                                }}
                            />
                        }
                    />
                </Pane>
                <Pane area="list" surface scroll label={copy.listLabel}>
                    <PaneBody>
                        <ListBody {...props} />
                    </PaneBody>
                </Pane>
                <Pane area="head" surface>
                    <MainHead {...props} />
                </Pane>
                {opened === null ? (
                    <Pane area="main" label={copy.detailLabel}>
                        <PaneBlank
                            message={copy.pickTitle}
                            description={copy.pickBody}
                            iconSource={nivoIconSource("review", "leading")}
                        />
                    </Pane>
                ) : (
                    <Pane area="main" scroll label={copy.detailLabel}>
                        <PaneBody {...(primary === undefined ? {} : { phonePrimary: primary })}>
                            <ResponsibilityDetail
                                row={opened.row}
                                copy={copy.detail}
                                avatarUrl={opened.avatarUrl}
                                ownerRole={opened.ownerRole}
                                dueDate={opened.dueDate}
                                isCopied={view.copiedId === opened.row.id}
                                isLoading={view.isWaiting}
                            />
                        </PaneBody>
                    </Pane>
                )}
            </PaneGrid>
        </Page>
    )
}
