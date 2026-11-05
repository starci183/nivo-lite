import { Alert, AlertDialog, IconTile, Stack } from "@starci/grammar/common"
import type { ListBoxItem } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { FactDetail } from "@/components/composites/FactDetail"
import { RowTrailing } from "@/components/composites/RowTrailing"
import { BrainPanes } from "@/components/frames/BrainPanes"
import { FactFormDrawer } from "@/components/frames/FactFormDrawer"
import { filterChoiceOf } from "@/components/composites/FilterGroup"
import { PaneBody } from "@/components/frames/PaneBody"
import { PaneList } from "@/components/frames/PaneList"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { BrainPageHeaderView, FactDrawerView, FactEntryView, FactsView } from "@/modules/types"

/** The words of the facts page. */
interface FactsCopy {
    readonly grid: string
    readonly listLabel: string
    readonly detailLabel: string
    readonly searchLabel: string
    readonly clearSearch: string
    readonly filterLabel: string
    readonly moreFilters: string
    readonly pickTitle: string
    readonly pickBody: string
    readonly noMatchTitle: string
    readonly noMatchBody: string
    readonly clearFilters: string
    readonly emptyBody: string
    readonly emptyAction: string
    readonly errorBody: string
    readonly back: string
}

/** Props for {@link BrainFactsBase}. */
export interface BrainFactsBaseProps {
    readonly props: {
        readonly header: BrainPageHeaderView
        readonly panelId: string
        readonly copy: FactsCopy
        readonly facts: FactsView
        /** The drawer that writes a fact or gives one a new value, which the address may open over the list. */
        readonly factDrawer: FactDrawerView | null
    }
    readonly on: {
        readonly reviewAll: () => void
        readonly selectTab: (id: string) => void
        readonly setFilter: (id: string) => void
        readonly setQuery: (value: string) => void
        readonly select: (id: string) => void
        readonly back: () => void
        readonly retry: () => void
        readonly add: () => void
        readonly askRetire: (id: string) => void
        readonly confirmRetire: () => void
        readonly cancelRetire: () => void
        readonly maintain: () => void
    }
}

/** The list rows: the fact and one line under it, its audience at the end. */
const itemsOf = (entries: ReadonlyArray<FactEntryView>): ReadonlyArray<ListBoxItem> =>
    entries.map((entry) => ({
        id: entry.id,
        label: entry.title,
        description: entry.line,
        leading: <IconTile source={nivoIconSource("review", "leading")} tone="neutral" />,
        trailing: <RowTrailing badge={entry.badge} />,
    }))

/** The list pane: the notice of what is due, the search over the type tabs, then the rows. */
const ListBody = (props: BrainFactsBaseProps) => {
    const { copy, facts } = props.props
    return (
        <SlotView
            slot={facts.slot}
            placeholder={facts.placeholder}
            labels={facts.slotLabels}
            errorDescription={copy.errorBody}
            emptyDescription={copy.emptyBody}
            onRetry={props.on.retry}
            render={(entries, isLoading) => (
                <Stack gap="row">
                    {facts.maintain === null ? null : (
                        <Alert
                            tone="cautionary"
                            title={facts.maintain.title}
                            description={facts.maintain.body}
                            action={{ label: facts.maintain.actionLabel, onAction: props.on.maintain }}
                        />
                    )}
                    <PaneList
                        label={copy.listLabel}
                        search={{
                            label: copy.searchLabel,
                            placeholder: copy.searchLabel,
                            clearLabel: copy.clearSearch,
                            value: facts.query,
                            onChange: props.on.setQuery,
                        }}
                        choice={filterChoiceOf(
                            facts.filters,
                            facts.filter,
                            { label: copy.filterLabel, moreLabel: copy.moreFilters },
                            props.on.setFilter,
                        )}
                        items={itemsOf(entries)}
                        selectedId={facts.selectedId}
                        onSelect={props.on.select}
                        empty={{
                            message: copy.noMatchTitle,
                            description: copy.noMatchBody,
                            actionLabel: copy.clearFilters,
                            onAction: () => {
                                props.on.setFilter("all")
                                props.on.setQuery("")
                            },
                        }}
                        isLoading={isLoading}
                    />
                </Stack>
            )}
        />
    )
}

/** The props of a part that draws the opened fact. */
interface OpenedProps extends BrainFactsBaseProps {
    readonly entry: FactEntryView
    readonly isWaiting: boolean
}

/** The opened fact, with the question asked before it stops being used. */
const DetailOf = (props: OpenedProps) => {
    const retire = props.props.facts.retire
    return (
        <PaneBody isWaiting={props.isWaiting}>
            <FactDetail
                detail={props.entry.detail}
                isLoading={props.isWaiting}
                onRetire={() => props.on.askRetire(props.entry.id)}
            />
            {retire === null ? null : (
                <AlertDialog
                    isOpen
                    onOpenChange={(open) => {
                        if (!open) props.on.cancelRetire()
                    }}
                    tone="negative"
                    title={retire.title}
                    description={retire.description}
                    confirmLabel={retire.confirmLabel}
                    cancelLabel={retire.cancelLabel}
                    onConfirm={props.on.confirmRetire}
                />
            )}
        </PaneBody>
    )
}

/**
 * Draws the facts of the Second Brain as the page of its tab: the header with its tab strip, then the panes (the facts narrowed by
 * type and search, and the opened fact with its value, its history and its commands). A phone shows the list, or the opened fact
 * with a way back. A settled read with no facts, or one that failed, is one notice across the page with the one action that answers it.
 */
export const BrainFactsBase = (props: BrainFactsBaseProps) => {
    const { copy, facts, header, factDrawer } = props.props
    return (
        <BrainPanes
            header={header}
            panelId={props.props.panelId}
            copy={{ ...copy, list: copy.listLabel, detail: copy.detailLabel }}
            grid={facts.grid}
            slot={facts.slot}
            placeholder={facts.placeholder}
            slotLabels={facts.slotLabels}
            selectedId={facts.selectedId}
            isFiltered={facts.isFiltered}
            glyph="review"
            on={props.on}
            list={
                <PaneBody
                    isWaiting={"isLoading" in facts.slot}
                    overlay={factDrawer === null ? null : <FactFormDrawer {...factDrawer} />}
                >
                    <ListBody {...props} />
                </PaneBody>
            }
            renderDetail={(entry, isWaiting) => <DetailOf {...props} entry={entry} isWaiting={isWaiting} />}
        />
    )
}
