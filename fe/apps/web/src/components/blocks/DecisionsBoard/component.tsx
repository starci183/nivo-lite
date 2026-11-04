import { Badge, IconTile, Page, Pane, PaneGrid, Select, Stack } from "@starci/grammar/common"
import type { ListBoxItem } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { DecisionDetail } from "@/components/composites/DecisionDetail"
import type { DecisionDetailCopy } from "@/components/composites/DecisionDetail"
import { FilterGroup } from "@/components/composites/FilterGroup"
import { PaneBlank } from "@/components/composites/PaneBlank"
import { PaneHead } from "@/components/composites/PaneHead"
import { RowTrailing } from "@/components/composites/RowTrailing"
import { PaneBody } from "@/components/frames/PaneBody"
import { PaneList } from "@/components/frames/PaneList"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { DataSlot, PaneGridLayout, SlotLabels, DecisionHistoryRowView } from "@/modules/types"

/** One filter option. */
export interface FilterTabView {
    readonly id: string
    readonly label: string
}

/** What the list shows once the data is in: the rows the filters let through and the line that counts them. */
export interface DecisionListView {
    readonly rows: ReadonlyArray<DecisionHistoryRowView>
    readonly count: string
    readonly isFiltered: boolean
}

/** The words of the decision history. */
export interface DecisionsBoardCopy {
    readonly grid: string
    readonly title: string
    readonly pageBody: string
    readonly listLabel: string
    readonly detailLabel: string
    readonly pickTitle: string
    readonly pickBody: string
    readonly emptyTitle: string
    readonly emptyBody: string
    readonly noMatchTitle: string
    readonly noMatchBody: string
    readonly clearFilters: string
    readonly errorBody: string
    readonly back: string
    readonly refresh: string
    readonly openLead: string
    readonly kindLabel: string
    readonly deptLabel: string
    readonly filterSearch: string
    readonly filterNoMatch: string
    readonly detail: DecisionDetailCopy
}

/** Copy and state of the decision history. */
export interface DecisionsBoardBaseProps {
    readonly props: {
        readonly copy: DecisionsBoardCopy
        readonly kindKey: string
        readonly kinds: ReadonlyArray<FilterTabView>
        readonly deptKey: string
        readonly depts: ReadonlyArray<FilterTabView>
        readonly slot: DataSlot<DecisionListView>
        /** The first read has no data yet. */
        readonly isWaiting: boolean
        readonly labels: SlotLabels
        /** The opened decision; the first when none was chosen. */
        readonly selectedId: string | null
        readonly grid: PaneGridLayout
    }
    readonly on: {
        readonly kind: (key: string) => void
        readonly dept: (key: string) => void
        readonly clear: () => void
        readonly retry: () => void
        readonly select: (id: string) => void
        readonly back: () => void
        readonly go: (href: string) => void
        /** The words of the "+N" overflow of the filter row. */
        readonly moreFilters: (count: number) => string
    }
}

type Props = DecisionsBoardBaseProps

/** One resting row: the skeleton keeps the geometry of the ready list and detail. */
const PLACEHOLDER_ROW: DecisionHistoryRowView = {
    id: "",
    title: "",
    departmentLabel: "",
    decider: "",
    isPolicy: true,
    outcomeLabel: "",
    outcomeTone: "neutral",
    line: "",
    whenShort: "",
    whenLong: "",
    reasonTitle: null,
    reasonHint: null,
    basis: null,
    note: null,
    leadHref: null,
    leadLabel: "",
}
const PLACEHOLDER: DecisionListView = {
    rows: ["a", "b", "c", "d", "e"].map((id) => ({ ...PLACEHOLDER_ROW, id })),
    count: "",
    isFiltered: false,
}

/** The list rows: the action, who decided and when, and at the end the outcome. */
const itemOf = (row: DecisionHistoryRowView): ListBoxItem => ({
    id: row.id,
    label: row.title,
    description: row.line,
    descriptionLines: 2,
    leading: <IconTile source={nivoIconSource("saved", "leading")} tone="neutral" />,
    trailing: <RowTrailing badge={{ label: row.outcomeLabel, tone: row.outcomeTone }} />,
})

/** The opened decision: the one chosen, else the first; a skeleton row while the read waits; nothing when there is none. */
const openedOf = (view: Props["props"]): DecisionHistoryRowView | null => {
    if (view.isWaiting) return PLACEHOLDER_ROW
    return ("items" in view.slot ? view.slot.items.rows : []).find((row) => row.id === view.selectedId) ?? null
}

/** The list body: the department choice over the rows, with the empty notice that fits (nothing yet, or no match). */
const ListBody = (props: Props) => {
    const { copy } = props.props
    return (
        <SlotView
            slot={props.props.slot}
            placeholder={PLACEHOLDER}
            labels={props.props.labels}
            errorDescription={copy.errorBody}
            onRetry={props.on.retry}
            render={(list, isLoading) => (
                <Stack gap="row">
                    <FilterGroup
                        choice={{
                            label: copy.kindLabel,
                            options: props.props.kinds.map((kind) => ({ value: kind.id, label: kind.label })),
                            value: props.props.kindKey,
                            onChange: props.on.kind,
                            moreLabel: props.on.moreFilters,
                            searchLabel: copy.filterSearch,
                            emptyLabel: copy.filterNoMatch,
                        }}
                        isLoading={isLoading}
                    />
                    <Select
                        label={copy.deptLabel}
                        isLabelHidden
                        options={props.props.depts.map((dept) => ({ id: dept.id, label: dept.label }))}
                        value={props.props.deptKey}
                        onValueChange={(key) => props.on.dept(key ?? "")}
                        isLoading={isLoading}
                    />
                    <PaneList
                        label={copy.listLabel}
                        items={list.rows.map(itemOf)}
                        selectedId={props.props.selectedId}
                        onSelect={props.on.select}
                        empty={
                            list.isFiltered
                                ? {
                                      message: copy.noMatchTitle,
                                      description: copy.noMatchBody,
                                      iconSource: nivoIconSource("filter", "leading"),
                                      actionLabel: copy.clearFilters,
                                      onAction: props.on.clear,
                                  }
                                : {
                                      message: copy.emptyTitle,
                                      description: copy.emptyBody,
                                      iconSource: nivoIconSource("saved", "leading"),
                                  }
                        }
                        isLoading={isLoading}
                        footer={list.count}
                    />
                </Stack>
            )}
        />
    )
}

/** The head band of the opened decision: what was decided and how it came out, who and when, and the way to the customer. */
const MainHead = (props: Props) => {
    const view = props.props
    const row = openedOf(view)
    if (row === null) {
        return (
            <PaneHead
                title={view.copy.title}
                headingLevel={1}
                description={view.copy.pageBody}
                back={{ label: view.copy.back, onPress: props.on.back }}
            />
        )
    }
    const leadHref = row.leadHref
    return (
        <PaneHead
            title={row.title}
            headingLevel={1}
            description={`${row.departmentLabel} · ${row.whenLong}`}
            mark={<IconTile source={nivoIconSource("saved", "leading")} tone="neutral" />}
            status={<Badge tone={row.outcomeTone}>{row.outcomeLabel}</Badge>}
            isLoading={view.isWaiting}
            back={{ label: view.copy.back, onPress: props.on.back }}
            {...(leadHref === null || view.isWaiting
                ? {}
                : { primary: { label: view.copy.openLead, onPress: () => props.on.go(leadHref) } })}
        />
    )
}

/** Draws the decision history as the chat pattern: the decisions beside the opened one; a phone shows one pane with a back control. */
export const DecisionsBoardBase = (props: DecisionsBoardBaseProps) => {
    const view = props.props
    const { copy } = view
    const row = openedOf(view)
    const leadHref = row?.leadHref ?? null
    const primary =
        leadHref === null || view.isWaiting ? undefined : { label: copy.openLead, onPress: () => props.on.go(leadHref) }
    return (
        <Page chrome="panes">
            <PaneGrid label={copy.grid} areas={view.grid.areas} columns={view.grid.columns} rows={view.grid.rows}>
                <Pane area="listHead" surface>
                    <PaneHead title={copy.title} />
                </Pane>
                <Pane area="list" surface scroll label={copy.listLabel}>
                    <PaneBody>
                        <ListBody {...props} />
                    </PaneBody>
                </Pane>
                <Pane area="head" surface>
                    <MainHead {...props} />
                </Pane>
                {row === null ? (
                    <Pane area="main" label={copy.detailLabel}>
                        <PaneBlank
                            message={copy.pickTitle}
                            description={copy.pickBody}
                            iconSource={nivoIconSource("saved", "leading")}
                        />
                    </Pane>
                ) : (
                    <Pane area="main" scroll label={copy.detailLabel}>
                        <PaneBody {...(primary === undefined ? {} : { phonePrimary: primary })}>
                            <DecisionDetail row={row} copy={copy.detail} isLoading={view.isWaiting} />
                        </PaneBody>
                    </Pane>
                )}
            </PaneGrid>
        </Page>
    )
}
