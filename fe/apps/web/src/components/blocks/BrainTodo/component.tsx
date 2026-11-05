import { Alert, Button, IconTile, Page, Pane, PaneGrid, Stack } from "@starci/grammar/common"
import type { ListBoxItem } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { BrainHeaderActions, brainHeaderTabs } from "@/components/composites/BrainHeaderActions"
import { DossierFindingDialogs } from "@/components/composites/DossierFindingDialogs"
import type { FindingDialogValues, FindingDialogView } from "@/components/composites/DossierFindingDialogs"
import { PaneBlank } from "@/components/composites/PaneBlank"
import { QueueDetail } from "@/components/composites/QueueDetail"
import { RowTrailing } from "@/components/composites/RowTrailing"
import { PaneBody } from "@/components/frames/PaneBody"
import { FactFormDrawer } from "@/components/frames/FactFormDrawer"
import { PaneList } from "@/components/frames/PaneList"
import { QueueAside } from "@/components/frames/QueueAside"
import { QUEUE_GLYPH, QUEUE_PLACEHOLDER, QueueHead, QueueNotice } from "@/components/frames/QueueHead"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { BrainPageHeaderView, FactDrawerView, QueueEntryView, QueueView } from "@/modules/types"

/** The words of the queue page. */
interface QueueCopy {
    readonly grid: string
    readonly listLabel: string
    readonly detailLabel: string
    readonly asideLabel: string
    readonly searchLabel: string
    readonly clearSearch: string
    readonly filterLabel: string
    readonly pickTitle: string
    readonly pickBody: string
    readonly noMatchTitle: string
    readonly noMatchBody: string
    readonly clearFilters: string
    readonly emptyBody: string
    readonly emptyAction: string
    readonly errorBody: string
    readonly back: string
    readonly moreActions: string
    readonly loadMore: string
    readonly closeAside: string
}

/** Props for {@link BrainTodoBase}. */
export interface BrainTodoBaseProps {
    readonly props: {
        readonly header: BrainPageHeaderView
        readonly panelId: string
        readonly copy: QueueCopy
        readonly queue: QueueView
        readonly dialog: FindingDialogView | null
        /** The drawer that writes a fact, which the address may open over the list. */
        readonly factDrawer: FactDrawerView | null
        readonly isAsideOpen: boolean
    }
    readonly on: {
        readonly reviewAll: () => void
        readonly selectTab: (id: string) => void
        readonly setFilter: (id: string) => void
        readonly setQuery: (value: string) => void
        readonly select: (id: string) => void
        readonly back: () => void
        readonly retry: () => void
        readonly loadMore: () => void
        readonly act: (entryId: string, actionId: string, partId?: string) => void
        readonly submitDialog: (values: FindingDialogValues) => void
        readonly closeDialog: () => void
        readonly openSources: () => void
        readonly asideOpenChange: (isOpen: boolean) => void
    }
}

type Props = BrainTodoBaseProps

/** The list rows: the title and one line under it, the kind at the end. */
const itemsOf = (entries: ReadonlyArray<QueueEntryView>): ReadonlyArray<ListBoxItem> =>
    entries.map((entry) => ({
        id: entry.id,
        label: entry.title,
        description: entry.line,
        leading: <IconTile source={nivoIconSource(QUEUE_GLYPH[entry.glyph], "leading")} tone="neutral" />,
        trailing: <RowTrailing badge={entry.badge} />,
    }))

/** The list pane: a notice for the regions that did not read, the search over the filters, then the rows. */
const ListBody = (props: Props) => {
    const { copy, queue } = props.props
    return (
        <SlotView
            slot={queue.slot}
            placeholder={QUEUE_PLACEHOLDER}
            labels={queue.slotLabels}
            errorDescription={copy.errorBody}
            emptyDescription={copy.emptyBody}
            emptyAction={{ label: copy.emptyAction, onAction: props.on.openSources }}
            onRetry={props.on.retry}
            render={(entries, isLoading) => (
                <Stack gap="row">
                    {queue.partialFailure === null ? null : (
                        <Alert
                            tone="negative"
                            title={queue.partialFailure}
                            action={{ label: queue.slotLabels.retry, onAction: props.on.retry }}
                        />
                    )}
                    <PaneList
                        label={copy.listLabel}
                        search={{
                            label: copy.searchLabel,
                            placeholder: copy.searchLabel,
                            clearLabel: copy.clearSearch,
                            value: queue.query,
                            onChange: props.on.setQuery,
                        }}
                        choice={{
                            label: copy.filterLabel,
                            options: queue.filters.map((one) => ({
                                value: one.id,
                                label: one.label,
                                ...(one.count === undefined ? {} : { count: one.count }),
                            })),
                            value: queue.filter,
                            onChange: props.on.setFilter,
                        }}
                        items={itemsOf(entries)}
                        selectedId={queue.selectedId}
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
                    {queue.hasNextPage ? (
                        <Button intent="neutral" onPress={props.on.loadMore}>
                            {copy.loadMore}
                        </Button>
                    ) : null}
                </Stack>
            )}
        />
    )
}

/** The props of a part that draws the opened item. */
interface OpenedProps extends BrainTodoBaseProps {
    readonly entry: QueueEntryView
    readonly isWaiting: boolean
}

/** The props of the head band: the opened item, when one is. */
interface HeadOfProps extends BrainTodoBaseProps {
    readonly entry: QueueEntryView | null
    readonly isWaiting: boolean
}

/** The notice that takes the whole page. */
const WholeNotice = (props: BrainTodoBaseProps) => (
    <QueueNotice
        queue={props.props.queue}
        errorBody={props.props.copy.errorBody}
        emptyBody={props.props.copy.emptyBody}
        emptyAction={props.props.copy.emptyAction}
        onRetry={props.on.retry}
        onOpenSources={props.on.openSources}
    />
)

/** The head band over the opened item (or over the notice that asks for a choice). */
const HeadOf = (props: HeadOfProps) => (
    <QueueHead
        entry={props.entry}
        isWaiting={props.isWaiting}
        parts={{
            title: props.props.copy.listLabel,
            back: props.props.copy.back,
            moreActions: props.props.copy.moreActions,
            onBack: props.on.back,
            onAct: props.on.act,
        }}
    />
)

/** The opened item with the dialog its commands may open. */
const DetailOf = (props: OpenedProps) => (
    <PaneBody isWaiting={props.isWaiting}>
        <QueueDetail
            detail={props.entry.detail}
            isLoading={props.isWaiting}
            onAction={(actionId, partId) => props.on.act(props.entry.id, actionId, partId)}
        />
        {props.props.dialog === null ? null : (
            <DossierFindingDialogs
                props={props.props.dialog}
                on={{ submit: props.on.submitDialog, close: props.on.closeDialog }}
            />
        )}
    </PaneBody>
)

/** What the page shows for the queue's status: the opened item, whether the read settled to a notice, the side pane and the grid. */
const layoutOf = (queue: QueueView) => {
    const isWaiting = "isLoading" in queue.slot
    const isWhole = !("items" in queue.slot) && !isWaiting
    const items = "items" in queue.slot ? queue.slot.items : []
    const entry = isWaiting
        ? (QUEUE_PLACEHOLDER[0] ?? null)
        : (items.find((one) => one.id === queue.selectedId) ?? null)
    return {
        isWaiting,
        isWhole,
        entry,
        aside: isWhole ? null : (entry?.aside ?? null),
        grid: queue.grid,
    }
}

/**
 * Draws the queue of what needs the owner as the page of its tab: the Second Brain header with its tab strip, then the panes
 * (the work list with its search and filters, the opened item with its commands, and what the item rests on). A phone shows the
 * list, or the opened item with a way back. Each region of the list draws its own skeleton; a settled read with no rows, or
 * one that failed, is one notice across the page with the one action that answers it.
 */
export const BrainTodoBase = (props: BrainTodoBaseProps) => {
    const { copy, queue, header } = props.props
    const { entry, isWaiting, isWhole, aside, grid } = layoutOf(queue)
    const actions = "isError" in queue.slot ? { review: null, add: null } : header.actions
    return (
        <Page
            chrome="panes"
            header={{
                ...header.heading,
                actions: <BrainHeaderActions review={actions.review} add={actions.add} onReview={props.on.reviewAll} />,
                tabs: brainHeaderTabs({ tabs: header.tabs, onSelect: props.on.selectTab }),
            }}
            measure="product"
        >
            <PaneGrid
                label={copy.grid}
                role="tabpanel"
                id={props.props.panelId}
                areas={grid.areas}
                columns={grid.columns}
                rows={grid.rows}
            >
                {isWhole ? (
                    <Pane area="main" label={copy.detailLabel}>
                        <WholeNotice {...props} />
                    </Pane>
                ) : null}
                {isWhole ? null : (
                    <Pane area="list" surface scroll label={copy.listLabel}>
                        <PaneBody
                            isWaiting={isWaiting}
                            overlay={
                                props.props.factDrawer === null ? null : <FactFormDrawer {...props.props.factDrawer} />
                            }
                        >
                            <ListBody {...props} />
                        </PaneBody>
                    </Pane>
                )}
                {isWhole ? null : (
                    <Pane area="head" surface>
                        <HeadOf {...props} entry={entry} isWaiting={isWaiting} />
                    </Pane>
                )}
                {!isWhole && entry === null ? (
                    <Pane area="main" label={copy.detailLabel}>
                        <PaneBlank
                            message={queue.isFiltered ? copy.noMatchTitle : copy.pickTitle}
                            description={queue.isFiltered ? copy.noMatchBody : copy.pickBody}
                            iconSource={nivoIconSource("brain", "leading")}
                        />
                    </Pane>
                ) : null}
                {!isWhole && entry !== null ? (
                    <Pane area="main" scroll label={copy.detailLabel}>
                        <DetailOf {...props} entry={entry} isWaiting={isWaiting} />
                    </Pane>
                ) : null}
                {aside === null ? null : (
                    <Pane
                        area="aside"
                        surface
                        scroll
                        label={copy.asideLabel}
                        collapse="drawer"
                        collapseLabel={copy.asideLabel}
                        openLabel={aside.title}
                        closeLabel={copy.closeAside}
                        isOpen={props.props.isAsideOpen}
                        onOpenChange={props.on.asideOpenChange}
                    >
                        <QueueAside aside={aside} isWaiting={isWaiting} />
                    </Pane>
                )}
            </PaneGrid>
        </Page>
    )
}
