import { SlotView } from "@nivo-lite/agent-sdk/client"
import { Badge, IconButton, IconTile } from "@starci/grammar/common"
import { PaneHead } from "@/components/composites/PaneHead"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { WorkThreadBoardHandlers, WorkThreadBoardView } from "@/modules/types"
import { THREAD_FEED_SKELETON } from "@/hooks/workThreads"

/** What the head of the opened thread draws and asks. */
interface ThreadHeadBandProps {
    readonly title: string
    readonly subtitle: string
    /** The chip of the approvals that wait, or none when nothing waits. */
    readonly pendingLabel: string | null
    readonly chainToggleLabel: string
    readonly backLabel: string
    readonly isLoading: boolean
    readonly onBack: () => void
    readonly onToggleChain: () => void
}

/** The head band of the opened thread: its mark, its name and facts, the approvals that wait, and the chain toggle. */
const ThreadHeadBand = (props: ThreadHeadBandProps) => (
    <PaneHead
        title={props.title}
        headingLevel={1}
        description={props.subtitle}
        mark={<IconTile source={nivoIconSource("review", "leading")} tone="neutral" />}
        isLoading={props.isLoading}
        back={{ label: props.backLabel, onPress: props.onBack }}
        actions={
            <>
                {props.pendingLabel === null ? null : <Badge tone="warning">{props.pendingLabel}</Badge>}
                <IconButton
                    intent="neutral"
                    source={nivoIconSource("sidebar", "leading")}
                    label={props.chainToggleLabel}
                    onPress={props.onToggleChain}
                />
            </>
        }
    />
)

/** What the middle head draws and asks. */
interface ThreadMainHeadProps {
    readonly view: WorkThreadBoardView
    readonly on: WorkThreadBoardHandlers
}

/** The head of the opened thread (through the same slot) or of the page while none is open. */
export const ThreadMainHead = (props: ThreadMainHeadProps) => {
    const { view } = props
    if (!view.thread.hasThread) {
        return (
            <PaneHead
                title={view.title}
                headingLevel={1}
                description={view.subtitle}
                back={{ label: view.labels.back, onPress: props.on.back }}
            />
        )
    }
    return (
        <SlotView
            slot={view.thread.slot}
            placeholder={THREAD_FEED_SKELETON}
            labels={view.thread.slotLabels}
            forbidden="hide"
            onRetry={props.on.retry}
            render={(feed, isLoading) => (
                <ThreadHeadBand
                    title={feed.title}
                    subtitle={feed.subtitle}
                    pendingLabel={feed.pendingCount > 0 ? view.labels.pendingApprovals(feed.pendingCount) : null}
                    chainToggleLabel={view.labels.chainToggle}
                    backLabel={view.labels.back}
                    isLoading={isLoading}
                    onBack={props.on.back}
                    onToggleChain={props.on.toggleChain}
                />
            )}
        />
    )
}
