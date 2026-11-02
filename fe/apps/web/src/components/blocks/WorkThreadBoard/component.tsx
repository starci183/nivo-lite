import {
    Button,
    Divider,
    EmptyNotice,
    Heading,
    Page,
    Pane,
    PaneGrid,
    PaneSection,
    Stack,
    SurfaceCard,
    Text,
} from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import { ThreadChainPanel } from "@/components/composites/ThreadChainPanel"
import { ThreadComposer } from "@/components/composites/ThreadComposer"
import { ThreadFeed } from "@/components/composites/ThreadFeed"
import { ThreadRail } from "@/components/composites/ThreadRail"
import type {
    ChainPanelView,
    ThreadFeedView,
    ThreadRowView,
    WorkThreadBoardHandlers,
    WorkThreadBoardView,
} from "@/modules/types"
import { THREAD_CLASS_NAME } from "./classNames"

/** The words, values and state of the work threads board, and what it asks. */
export interface WorkThreadBoardBaseProps {
    readonly props: WorkThreadBoardView
    readonly on: WorkThreadBoardHandlers
}

const SKELETON_FEED: ThreadFeedView = { title: "", subtitle: "", messages: [] }
const SKELETON_CHAIN: ChainPanelView = {
    summaryLine: "",
    stateLine: "",
    stateTone: "neutral",
    steps: [],
    isComplete: false,
}
const NO_ROWS: ReadonlyArray<ThreadRowView> = []

/** The threads on the left, with the form that opens a new one. */
const Rail = (props: WorkThreadBoardBaseProps) => {
    const rail = props.props.rail
    return (
        <SurfaceCard label={rail.title}>
            <SlotView
                slot={rail.slot}
                placeholder={NO_ROWS}
                labels={rail.slotLabels}
                onRetry={props.on.retry}
                render={(rows, isLoading) => (
                    <ThreadRail
                        title={rail.title}
                        listLabel={rail.listLabel}
                        rows={rows}
                        isLoading={isLoading}
                        newLabel={rail.newLabel}
                        isFormOpen={rail.isFormOpen}
                        titleDraft={rail.titleDraft}
                        isCreating={rail.isCreating}
                        form={rail.form}
                        onPick={props.on.pick}
                        onOpenForm={props.on.openForm}
                        onCancelForm={props.on.cancelForm}
                        onTitle={props.on.title}
                        onCreate={props.on.create}
                    />
                )}
            />
            {rail.hasNextPage || rail.paginationFailure !== null ? (
                <Stack gap="inline">
                    {rail.paginationFailure === null ? null : (
                        <Text size="sm" live="polite">
                            {rail.paginationFailure}
                        </Text>
                    )}
                    <Button
                        intent="neutral"
                        size="sm"
                        isPending={rail.isLoadingMore}
                        isDisabled={rail.isLoadingMore}
                        onPress={rail.paginationFailure === null ? props.on.loadMore : props.on.retryPage}
                    >
                        {rail.paginationFailure === null ? rail.loadMoreLabel : rail.retryPageLabel}
                    </Button>
                </Stack>
            ) : null}
        </SurfaceCard>
    )
}

/** The open thread: its title, its messages and the composer; the notice when no thread is open. */
const Thread = (props: WorkThreadBoardBaseProps) => {
    const thread = props.props.thread
    return (
        <SurfaceCard label={props.props.title}>
            <div className={THREAD_CLASS_NAME}>
                <SlotView
                    slot={thread.slot}
                    placeholder={SKELETON_FEED}
                    labels={thread.slotLabels}
                    onRetry={props.on.retry}
                    render={(feed, isLoading) => (
                        <>
                            <Stack gap="identity">
                                <Heading level={3} isLoading={isLoading}>
                                    {feed.title}
                                </Heading>
                                <Text size="sm" tone="muted">
                                    {feed.subtitle}
                                </Text>
                            </Stack>
                            <Divider semantics="presentation" />
                            <ThreadFeed
                                label={thread.feedLabel}
                                messages={feed.messages}
                                isLoading={isLoading}
                                emptyMessage={thread.feedEmpty}
                                aiLabel={thread.aiLabel}
                                quotedLabel={thread.quotedLabel}
                                approvalLabels={thread.approvalLabels}
                                decidingId={thread.decidingId}
                                onApprove={props.on.approve}
                                onReject={props.on.reject}
                            />
                        </>
                    )}
                />
                <ThreadComposer
                    label={thread.composerLabel}
                    placeholder={thread.composerPlaceholder}
                    hint={thread.composerHint}
                    mentionLabel={thread.mentionLabel}
                    sendLabel={thread.sendLabel}
                    draft={thread.draft}
                    options={thread.options}
                    isSending={thread.isSending}
                    isDisabled={!thread.hasThread}
                    onDraft={props.on.draft}
                    onPick={props.on.pickMention}
                    onSend={props.on.send}
                />
            </div>
        </SurfaceCard>
    )
}

/** The Execution chain on the right. */
const Chain = (props: WorkThreadBoardBaseProps) => {
    const chain = props.props.chain
    return (
        <SurfaceCard label={chain.title}>
            <SlotView
                slot={chain.slot}
                placeholder={SKELETON_CHAIN}
                labels={chain.slotLabels}
                onRetry={props.on.retry}
                render={(view, isLoading) => (
                    <ThreadChainPanel view={view} labels={chain.labels} isLoading={isLoading} />
                )}
            />
        </SurfaceCard>
    )
}

/** The notice that stands in the middle panel while no thread exists yet. */
/** The words of the notice that stands in for the open thread. */
type NoThreadProps = { readonly title: string; readonly message: string }

const NoThread = (props: NoThreadProps) => (
    <SurfaceCard label={props.title}>
        <div className={THREAD_CLASS_NAME}>
            <EmptyNotice message={props.message} />
        </div>
    </SurfaceCard>
)

/** Draws the work threads board: the threads on the left, the open thread in the middle, the execution chain on the right. */
export const WorkThreadBoardBase = (props: WorkThreadBoardBaseProps) => (
    <Page
        measure="product"
        chrome="panes"
        minHeight="lg"
        header={{
            breadcrumbs: { label: props.props.crumbLabel, items: props.props.crumbs },
            title: props.props.title,
            description: props.props.subtitle,
        }}
    >
        <PaneGrid
            label={props.props.title}
            areas={{ base: ["rail", "thread", "chain"], wide: ["rail thread chain"] }}
            columns={{ base: ["fill"], wide: ["compact", "fill", "wide"] }}
        >
            <Pane area="rail" scroll label={props.props.rail.title}>
                <PaneSection grow>
                    <Rail {...props} />
                </PaneSection>
            </Pane>
            <Pane area="thread" scroll label={props.props.title}>
                <PaneSection grow>
                    {props.props.thread.hasThread ? (
                        <Thread {...props} />
                    ) : (
                        <NoThread title={props.props.title} message={props.props.thread.noSelection} />
                    )}
                </PaneSection>
            </Pane>
            <Pane area="chain" scroll label={props.props.chain.title}>
                <PaneSection grow>
                    <Chain {...props} />
                </PaneSection>
            </Pane>
        </PaneGrid>
    </Page>
)
