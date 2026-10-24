import {
    Breadcrumbs,
    Button,
    EmptyNotice,
    PageContainer,
    SectionHeader,
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
import {
    HEAD_CLASS_NAME,
    PAGE_CLASS_NAME,
    PANELS_CLASS_NAME,
    PAGINATION_CLASS_NAME,
    THREAD_CLASS_NAME,
    THREAD_HEAD_CLASS_NAME,
} from "./classNames"

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
        <SurfaceCard label={rail.title} frame="bounded">
            <SlotView slot={rail.slot} placeholder={NO_ROWS} labels={rail.slotLabels} onRetry={props.on.retry}>
                {(rows, isSkeleton) => (
                    <ThreadRail
                        title={rail.title}
                        listLabel={rail.listLabel}
                        rows={rows}
                        isSkeleton={isSkeleton}
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
            </SlotView>
            {rail.hasNextPage || rail.paginationFailure !== null ? (
                <div className={PAGINATION_CLASS_NAME}>
                    {rail.paginationFailure === null ? null : (
                        <Text size="sm" live="polite">
                            {rail.paginationFailure}
                        </Text>
                    )}
                    <Button
                        variant="secondary"
                        size="sm"
                        isPending={rail.isLoadingMore}
                        isDisabled={rail.isLoadingMore}
                        onPress={rail.paginationFailure === null ? props.on.loadMore : props.on.retryPage}
                    >
                        {rail.paginationFailure === null ? rail.loadMoreLabel : rail.retryPageLabel}
                    </Button>
                </div>
            ) : null}
        </SurfaceCard>
    )
}

/** The open thread: its title, its messages and the composer; the notice when no thread is open. */
const Thread = (props: WorkThreadBoardBaseProps) => {
    const thread = props.props.thread
    return (
        <SurfaceCard label={props.props.title} frame="frameless">
            <div className={THREAD_CLASS_NAME}>
                <SlotView
                    slot={thread.slot}
                    placeholder={SKELETON_FEED}
                    labels={thread.slotLabels}
                    onRetry={props.on.retry}
                >
                    {(feed, isSkeleton) => (
                        <>
                            <div className={THREAD_HEAD_CLASS_NAME}>
                                <Text weight="semibold">{feed.title}</Text>
                                <Text size="sm" tone="muted">
                                    {feed.subtitle}
                                </Text>
                            </div>
                            <ThreadFeed
                                label={thread.feedLabel}
                                messages={feed.messages}
                                isSkeleton={isSkeleton}
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
                </SlotView>
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
        <SurfaceCard label={chain.title} frame="bounded">
            <SlotView slot={chain.slot} placeholder={SKELETON_CHAIN} labels={chain.slotLabels} onRetry={props.on.retry}>
                {(view, isSkeleton) => <ThreadChainPanel view={view} labels={chain.labels} isSkeleton={isSkeleton} />}
            </SlotView>
        </SurfaceCard>
    )
}

/** The notice that stands in the middle panel while no thread exists yet. */
/** The words of the notice that stands in for the open thread. */
type NoThreadProps = { readonly title: string; readonly message: string }

const NoThread = (props: NoThreadProps) => (
    <SurfaceCard label={props.title} frame="frameless">
        <div className={THREAD_CLASS_NAME}>
            <EmptyNotice message={props.message} />
        </div>
    </SurfaceCard>
)

/** Draws the work threads board: the threads on the left, the open thread in the middle, the execution chain on the right. */
export const WorkThreadBoardBase = (props: WorkThreadBoardBaseProps) => (
    <PageContainer measure="product">
        <div className={PAGE_CLASS_NAME}>
            <div className={HEAD_CLASS_NAME}>
                <Breadcrumbs label={props.props.crumbLabel} items={props.props.crumbs} />
                <SectionHeader level={1} title={props.props.title} description={props.props.subtitle} />
            </div>
            <div className={PANELS_CLASS_NAME}>
                <Rail {...props} />
                {props.props.thread.hasThread ? (
                    <Thread {...props} />
                ) : (
                    <NoThread title={props.props.title} message={props.props.thread.noSelection} />
                )}
                <Chain {...props} />
            </div>
        </div>
    </PageContainer>
)
