import { SurfaceCard } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { ConnectionSetupCard } from "@/components/composites/ConnectionSetupCard"
import type { DataSlot, SlotLabels, ZaloFactView } from "@/modules/types"

/** Fake facts of the same shape: the skeleton reuses the ready tree. */
const PLACEHOLDER: ReadonlyArray<ZaloFactView> = ["a", "b", "c", "d"].map((id) => ({ id, label: "-", value: "-" }))

/** The setup card while the connection is set up or waits for its first transaction. */
interface SepaySetupView {
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

/** The words, the reads and the retry of the overview facts of a SePay connection. */
export interface SepayHealthBaseProps {
    readonly props: {
        readonly title: string
        readonly facts: DataSlot<ReadonlyArray<ZaloFactView>>
        readonly slotLabels: SlotLabels
        /** Present while the setup is unfinished. */
        readonly setup?: SepaySetupView
    }
    readonly on: { readonly retry: () => void }
}

/**
 * Draws the overview regions of a SePay connection: while it is set up or waits for its first transaction, the four phases with the
 * one step left; then the connection's details (bank, account, holder, environment, webhook, key, health) as term and value rows.
 */
export const SepayHealthBase = (props: SepayHealthBaseProps) => {
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
                    <SurfaceCard
                        kind="details"
                        label={props.props.title}
                        isLoading={isLoading}
                        items={facts.map((fact) => ({ id: fact.id, term: fact.label, description: fact.value }))}
                    />
                )}
            />
        </>
    )
}
