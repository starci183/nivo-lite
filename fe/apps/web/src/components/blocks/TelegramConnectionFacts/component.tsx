import { SlotView } from "@nivo-lite/agent-sdk/client"
import { ConnectionFactsCard } from "@/components/composites/ConnectionFactsCard"
import { ConnectionSetupCard } from "@/components/composites/ConnectionSetupCard"
import type { ConnectionFactView, DataSlot, SlotLabels } from "@/modules/types"

/** Fake facts of the same shape: the skeleton reuses the ready tree. */
const PLACEHOLDER: ReadonlyArray<ConnectionFactView> = ["a", "b", "c"].map((id) => ({ id, label: "-", value: "-" }))

/** The setup card while the bot is set up or waits for its first message. */
interface TelegramSetupView {
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

/** The words, the reads and the retry of the overview facts of a Telegram bot connection. */
export interface TelegramConnectionFactsBaseProps {
    readonly props: {
        readonly title: string
        readonly facts: DataSlot<ReadonlyArray<ConnectionFactView>>
        readonly slotLabels: SlotLabels
        /** Present while the setup is unfinished. */
        readonly setup?: TelegramSetupView
    }
    readonly on: { readonly retry: () => void }
}

/**
 * Draws the overview regions of a Telegram bot connection: while it is set up or waits for its first message, the four phases with
 * the one step left; then the connection's facts (bot, webhook, messages held back, agents) as term and value rows.
 */
export const TelegramConnectionFactsBase = (props: TelegramConnectionFactsBaseProps) => {
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
