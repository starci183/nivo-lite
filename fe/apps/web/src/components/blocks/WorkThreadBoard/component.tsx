import { Badge, Button, Cluster, Icon, IconButton, IconTile, Page, Pane, PaneGrid, Text } from "@starci/grammar/common"
import type { ListBoxItem } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { PaneBlank } from "@/components/composites/PaneBlank"
import { PaneHead } from "@/components/composites/PaneHead"
import { ThreadLoadMore } from "@/components/composites/ThreadLoadMore"
import { ThreadNewForm } from "@/components/composites/ThreadNewForm"
import { OfficeThreadScroll } from "@/components/frames/OfficeThreadScroll"
import { PaneBody } from "@/components/frames/PaneBody"
import { PaneList } from "@/components/frames/PaneList"
import { ThreadChainBody } from "@/components/frames/ThreadChainBody"
import { ThreadComposerBody } from "@/components/frames/ThreadComposerBody"
import { ThreadFeedBody } from "@/components/frames/ThreadFeedBody"
import { ThreadMainHead } from "@/components/frames/ThreadMainHead"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { ThreadRowView, WorkThreadBoardHandlers, WorkThreadBoardView } from "@/modules/types"

/** The words, values and state of the work threads board, and what it asks. */
export interface WorkThreadBoardBaseProps {
    readonly props: WorkThreadBoardView
    readonly on: WorkThreadBoardHandlers
}

type Props = WorkThreadBoardBaseProps

/** One thread as a row: its mark, its title, and under it where it stands and how many messages it holds. */
const itemOf = (row: ThreadRowView): ListBoxItem => ({
    id: row.id,
    label: row.title,
    descriptionLines: 1,
    leading: <IconTile source={nivoIconSource("review", "leading")} tone="neutral" />,
    description: (
        <Cluster gap="inline">
            <Badge tone={row.statusTone} isDot>
                {row.statusLabel}
            </Badge>
            <Text as="span" size="xs" tone="muted">
                {row.countLabel}
            </Text>
        </Cluster>
    ),
})

const NO_ROWS: ReadonlyArray<ThreadRowView> = []

/** The threads pane body: the threads through the slot's one status recipe, and the way to more of them. */
const RailBody = (props: Props) => {
    const { rail, labels } = props.props
    return (
        <>
            <SlotView
                slot={rail.slot}
                placeholder={NO_ROWS}
                labels={rail.slotLabels}
                emptyDescription={labels.emptyRailBody}
                emptyIconSource={nivoIconSource("review", "leading")}
                emptyAction={{ label: rail.newLabel, onAction: props.on.openForm }}
                onRetry={props.on.retry}
                render={(rows, isLoading) => (
                    <>
                        {rail.isFormOpen ? (
                            <ThreadNewForm
                                form={rail.form}
                                isCreating={rail.isCreating}
                                titleDraft={rail.titleDraft}
                                onCreate={props.on.create}
                                onTitle={props.on.title}
                                onCancelForm={props.on.cancelForm}
                            />
                        ) : null}
                        <PaneList
                            label={rail.listLabel}
                            items={rows.map(itemOf)}
                            selectedId={rows.find((row) => row.isSelected)?.id ?? null}
                            onSelect={props.on.pick}
                            isLoading={isLoading}
                            empty={{
                                message: labels.emptyRailTitle,
                                description: labels.emptyRailBody,
                                iconSource: nivoIconSource("review", "leading"),
                                actionLabel: rail.newLabel,
                                onAction: props.on.openForm,
                            }}
                        />
                    </>
                )}
            />
            <ThreadLoadMore rail={rail} onLoadMore={props.on.loadMore} onRetryPage={props.on.retryPage} />
        </>
    )
}

/** The head band of the threads pane: the title and the one command that opens a new thread. */
const RailHead = (props: Props) => (
    <PaneHead
        title={props.props.rail.title}
        actions={
            <Button
                intent="alternative"
                size="sm"
                startContent={<Icon source={nivoIconSource("add", "leading")} usage="leading" />}
                onPress={props.on.openForm}
            >
                {props.props.rail.newLabel}
            </Button>
        }
    />
)

/** The head band of the chain pane: its name and the control that closes it. */
const ChainHead = (props: Props) => (
    <PaneHead
        title={props.props.chain.title}
        actions={
            <IconButton
                intent="neutral"
                source={nivoIconSource("close", "leading")}
                label={props.props.labels.chainClose}
                onPress={props.on.toggleChain}
            />
        }
    />
)

/** Draws the work threads as panes: the threads, the open thread with its composer, and the execution chain beside it. */
export const WorkThreadBoardBase = (props: WorkThreadBoardBaseProps) => {
    const view = props.props
    const hasThread = view.thread.hasThread
    return (
        <Page chrome="panes">
            <PaneGrid label={view.title} areas={view.grid.areas} columns={view.grid.columns} rows={view.grid.rows}>
                <Pane area="listHead" surface>
                    <RailHead {...props} />
                </Pane>
                <Pane area="list" surface scroll label={view.rail.listLabel}>
                    <PaneBody>
                        <RailBody {...props} />
                    </PaneBody>
                </Pane>
                <Pane area="head" surface>
                    <ThreadMainHead view={view} on={props.on} />
                </Pane>
                {hasThread ? (
                    <Pane area="thread">
                        <OfficeThreadScroll label={view.thread.feedLabel}>
                            <ThreadFeedBody view={view} on={props.on} />
                        </OfficeThreadScroll>
                    </Pane>
                ) : (
                    <Pane area="thread">
                        <PaneBlank
                            message={view.labels.noSelectionTitle}
                            description={view.thread.noSelection}
                            iconSource={nivoIconSource("review", "leading")}
                        />
                    </Pane>
                )}
                {hasThread ? (
                    <Pane area="composer" surface>
                        <ThreadComposerBody view={view} on={props.on} />
                    </Pane>
                ) : null}
                {hasThread ? (
                    <Pane area="asideHead" surface>
                        <ChainHead {...props} />
                    </Pane>
                ) : null}
                {hasThread ? (
                    <Pane
                        area="aside"
                        surface
                        scroll
                        label={view.chain.title}
                        collapse="drawer"
                        collapseLabel={view.chain.title}
                        openLabel={view.labels.chainOpen}
                        closeLabel={view.labels.chainClose}
                        isOpen={view.isChainDrawerOpen}
                        onOpenChange={props.on.chainDrawerOpenChange}
                    >
                        <PaneBody>
                            <ThreadChainBody view={view} on={props.on} />
                        </PaneBody>
                    </Pane>
                ) : null}
            </PaneGrid>
        </Page>
    )
}
