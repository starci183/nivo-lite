import { SlotView } from "@nivo-lite/agent-sdk/client"
import { ConnectionFactsCard } from "@/components/composites/ConnectionFactsCard"
import { ConnectionSetupCard } from "@/components/composites/ConnectionSetupCard"
import type { DataSlot, SlotLabels, ZaloFactView } from "@/modules/types"

/** Fake facts of the same shape: the skeleton reuses the ready tree. */
const PLACEHOLDER: ReadonlyArray<ZaloFactView> = ["a", "b", "c", "d"].map((id) => ({ id, label: "-", value: "-" }))

/** The setup card while the OA is set up or waits for its first message. */
interface ZaloSetupView {
    readonly title: string
    readonly phases: ReadonlyArray<string>
    readonly current: number
    readonly stateLabels: { readonly complete: string; readonly current: string; readonly upcoming: string }
    readonly next: {
        readonly title: string
        readonly body: string
        readonly action?: { readonly label: string; readonly href: string }
    }
}

/** The words, the reads and the retry of the overview facts of a Zalo OA connection. */
export interface ZaloConnectionFactsBaseProps {
    readonly props: {
        readonly title: string
        readonly facts: DataSlot<ReadonlyArray<ZaloFactView>>
        readonly slotLabels: SlotLabels
        /** Present while the setup is unfinished. */
        readonly setup?: ZaloSetupView
    }
    readonly on: { readonly retry: () => void }
}

/**
 * Draws the overview regions of a Zalo OA connection: while it is set up or waits for its first message, the four phases with the one
 * step left; then the connection's facts (token, followers, agents, app keys) as term and value rows.
 */
export const ZaloConnectionFactsBase = (props: ZaloConnectionFactsBaseProps) => {
    const setup = props.props.setup
    return (
        <>
            {setup === undefined ? null : (
                <ConnectionSetupCard
                    title={setup.title}
                    phases={setup.phases}
                    current={setup.current}
                    stateLabels={setup.stateLabels}
                    next={setup.next}
                />
            )}
            <SlotView
                slot={props.props.facts}
                placeholder={PLACEHOLDER}
                labels={props.props.slotLabels}
                onRetry={props.on.retry}
                render={(facts, isLoading) => (
                    <ConnectionFactsCard title={props.props.title} facts={facts} isLoading={isLoading} />
                )}
            />
        </>
    )
}
