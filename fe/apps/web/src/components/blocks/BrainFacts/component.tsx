import { Alert, Stack, type FooterZone, type HeaderZone } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { ConflictDrawer } from "@/components/composites/ConflictDrawer"
import { FactDetailDrawer } from "@/components/composites/FactDetailDrawer"
import { FactPickTable } from "@/components/composites/FactPickTable"
import { FactMapCard, factModeZoneOf } from "@/components/frames/FactMapCard"
import { PickSelectionBar } from "@/components/composites/PickSelectionBar"
import { BrainKnowledgeFrame } from "@/components/frames/BrainKnowledgeFrame"
import { FactFormDrawer } from "@/components/frames/FactFormDrawer"
import type { FactCardWords, FactMapView, FactMode } from "@/modules/brain"
import type {
    BrainPageHeaderView,
    ConflictDrawerView,
    DataSlot,
    FactDrawerDetailView,
    FactsPagingView,
    FactDrawerView,
    FactPickCopy,
    FactPickGroupView,
    PickConfirmView,
    PickSelectionBarView,
    SlotLabels,
} from "@/modules/types"

/** The words of the controls of the facts page. */
interface FactsWords {
    readonly statusLabel: string
    readonly searchLabel: string
    readonly clearSearch: string
    readonly groupingLabel: string
    readonly bySubject: string
    readonly byDocument: string
    readonly errorBody: string
}

/** Props for {@link BrainFactsBase}. */
export interface BrainFactsBaseProps {
    readonly props: {
        readonly header: BrainPageHeaderView
        /** The groups of facts as the brain read settled: loading, failed, or ready. */
        readonly slot: DataSlot<ReadonlyArray<FactPickGroupView>>
        readonly labels: SlotLabels
        readonly copy: FactPickCopy
        readonly words: FactsWords
        /** The words of the paging footer. */
        readonly pager: {
            readonly nav: string
            readonly previous: string
            readonly next: string
            /** "Trang {page}" with the page left to fill in. */
            readonly pageTemplate: string
            /** "1-50 / 120", already worded; empty when there is no paging. */
            readonly summary: string
        }
        /** The paging of the list; null when everything fits one page or the tab is drawn from the whole read. */
        readonly paging: FactsPagingView | null
        readonly count: number
        readonly status: ReadonlyArray<{ readonly id: string; readonly label: string; readonly count: number }>
        readonly selectedStatus: string
        readonly query: string
        readonly grouping: "subject" | "document"
        readonly canWrite: boolean
        readonly maintain: { readonly title: string; readonly body: string; readonly actionLabel: string } | null
        readonly bar: PickSelectionBarView
        readonly confirm: PickConfirmView | null
        readonly conflict: ConflictDrawerView | null
        readonly detail: FactDrawerDetailView | null
        /** The drawer that writes a fact or gives one a new value, which the address may open. */
        readonly factDrawer: FactDrawerView | null
        /** The words of the card around the facts, how it draws them now, and the map of the same facts. */
        readonly card: FactCardWords
        readonly mode: FactMode
        readonly map: FactMapView
    }
    readonly on: {
        readonly selectTab: (id: string) => void
        readonly setStatus: (id: string) => void
        readonly setQuery: (value: string) => void
        readonly setPage: (page: number) => void
        readonly setGrouping: (id: string) => void
        readonly retry: () => void
        readonly maintain: () => void
        readonly toggleRow: (key: string) => void
        readonly toggleGroup: (groupId: string) => void
        readonly toggleOpen: (groupId: string) => void
        readonly clear: () => void
        readonly askApprove: () => void
        readonly askReject: () => void
        readonly cancel: () => void
        readonly confirm: () => void
        readonly open: (factId: string) => void
        readonly closeDetail: () => void
        readonly edit: () => void
        readonly approve: () => void
        readonly reject: () => void
        readonly menu: (id: string) => void
        readonly confirmRetire: () => void
        readonly cancelRetire: () => void
        readonly compare: (key: string) => void
        readonly closeConflict: () => void
        readonly choose: (id: string) => void
        readonly confirmChoice: () => void
        readonly setMode: (id: string) => void
        readonly map: {
            readonly setView: (id: string) => void
            readonly select: (id: string | null) => void
            readonly approve: () => void
            readonly edit: () => void
            readonly compare: () => void
        }
    }
}

/** The zones above the table: the selection bar first, then the states with the search, then the grouping. */
const headersOf = (props: BrainFactsBaseProps): ReadonlyArray<HeaderZone> => {
    const { words } = props.props
    const picked: ReadonlyArray<HeaderZone> =
        props.props.bar.count === 0
            ? []
            : [
                  {
                      kind: "custom",
                      children: (
                          <PickSelectionBar
                              props={{ bar: props.props.bar, confirm: props.props.confirm }}
                              on={{
                                  clear: props.on.clear,
                                  askReject: props.on.askReject,
                                  askApprove: props.on.askApprove,
                                  cancel: props.on.cancel,
                                  confirm: props.on.confirm,
                              }}
                          />
                      ),
                  },
              ]
    return [
        factModeZoneOf(props.props.card, props.props.mode, props.on.setMode),
        ...picked,
        {
            kind: "filter",
            label: words.statusLabel,
            items: props.props.status.map((one) => ({ id: one.id, label: one.label, count: one.count })),
            selectedKey: props.props.selectedStatus,
            onSelect: props.on.setStatus,
        },
        {
            kind: "search",
            label: words.searchLabel,
            placeholder: words.searchLabel,
            clearLabel: words.clearSearch,
            value: props.props.query,
            onChange: props.on.setQuery,
        },
        {
            kind: "switch",
            label: words.groupingLabel,
            title: props.props.bar.hint,
            items: [
                { id: "subject", label: words.bySubject },
                { id: "document", label: words.byDocument },
            ],
            selectedKey: props.props.grouping,
            onSelect: props.on.setGrouping,
        },
    ]
}

/** The zone under the table: the pager of the server's pages, only when there is more than one page. */
const footersOf = (props: BrainFactsBaseProps): ReadonlyArray<FooterZone> => {
    const { paging, pager } = props.props
    if (paging === null) return []
    return [
        {
            kind: "paging",
            page: paging.page,
            pageCount: paging.pageCount,
            onPage: props.on.setPage,
            labels: {
                nav: pager.nav,
                previous: pager.previous,
                next: pager.next,
                page: (page) => pager.pageTemplate.replace("{page}", String(page)),
                summary: pager.summary,
            },
        },
    ]
}

/** The card of the map: the same facts, drawn as subjects, facts and the documents they cite. */
const MapBody = (props: BrainFactsBaseProps) => (
    <FactMapCard
        props={{ words: props.props.card, view: props.props.map }}
        on={{
            setMode: props.on.setMode,
            setView: props.on.map.setView,
            select: props.on.map.select,
            retry: props.on.retry,
            approve: props.on.map.approve,
            edit: props.on.map.edit,
            compare: props.on.map.compare,
        }}
    />
)

/** The table of facts, with the notice of what is due above it; the read's own notice with its retry when it failed. */
const Body = (props: BrainFactsBaseProps) => {
    const { words, maintain } = props.props
    if (props.props.mode === "map") return <MapBody {...props} />
    return (
        <SlotView
            slot={props.props.slot}
            placeholder={[]}
            labels={props.props.labels}
            errorDescription={words.errorBody}
            emptyDescription={props.props.copy.emptyBody}
            onRetry={props.on.retry}
            render={(groups, isLoading) => (
                <Stack gap="section">
                    {maintain === null ? null : (
                        <Alert
                            tone="cautionary"
                            title={maintain.title}
                            description={maintain.body}
                            action={{ label: maintain.actionLabel, onAction: props.on.maintain }}
                        />
                    )}
                    <FactPickTable
                        props={{
                            copy: { ...props.props.copy, label: props.props.card.title },
                            fact: String(props.props.count),
                            groups,
                            headers: headersOf(props),
                            footers: footersOf(props),
                            canWrite: props.props.canWrite,
                            isLoading,
                        }}
                        on={{
                            toggleRow: props.on.toggleRow,
                            toggleGroup: props.on.toggleGroup,
                            toggleOpen: props.on.toggleOpen,
                            open: props.on.open,
                            compare: props.on.compare,
                        }}
                    />
                </Stack>
            )}
        />
    )
}

/**
 * The facts chip of the knowledge tab: the header and the chips, then one table of every fact, the waiting ones with the ones in use,
 * grouped by subject (or by document) with a tick per group and per row and the selection bar at the top. A row opens its detail in a
 * drawer; a conflict opens the comparison.
 */
export const BrainFactsBase = (props: BrainFactsBaseProps) => (
    <BrainKnowledgeFrame header={props.props.header} onSelectTab={props.on.selectTab}>
        <Body {...props} />
        <ConflictDrawer
            props={{ view: props.props.conflict }}
            on={{ close: props.on.closeConflict, choose: props.on.choose, confirm: props.on.confirmChoice }}
        />
        <FactDetailDrawer
            props={{ view: props.props.detail }}
            on={{
                close: props.on.closeDetail,
                edit: props.on.edit,
                approve: props.on.approve,
                reject: props.on.reject,
                menu: props.on.menu,
                confirmRetire: props.on.confirmRetire,
                cancelRetire: props.on.cancelRetire,
            }}
        />
        {props.props.factDrawer === null ? null : <FactFormDrawer {...props.props.factDrawer} />}
    </BrainKnowledgeFrame>
)
