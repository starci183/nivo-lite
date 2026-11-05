import { SlotView } from "@nivo-lite/agent-sdk/client"
import { ThreadChainPanel } from "@/components/composites/ThreadChainPanel"
import type { WorkThreadBoardHandlers, WorkThreadBoardView } from "@/modules/types"
import { THREAD_CHAIN_SKELETON } from "@/hooks/workThreads"

/** What the execution chain draws and asks. */
interface ThreadChainBodyProps {
    readonly view: WorkThreadBoardView
    readonly on: WorkThreadBoardHandlers
}

/** The execution chain through the slot's one status recipe. */
export const ThreadChainBody = (props: ThreadChainBodyProps) => {
    const { chain } = props.view
    return (
        <SlotView
            slot={chain.slot}
            placeholder={THREAD_CHAIN_SKELETON}
            labels={chain.slotLabels}
            forbidden="hide"
            onRetry={props.on.retry}
            render={(view, isLoading) => <ThreadChainPanel view={view} labels={chain.labels} isLoading={isLoading} />}
        />
    )
}
