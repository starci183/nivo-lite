import { Text, Link } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels } from "@/modules/types"

/** The line that sends the owner to the queue where the facts read from the documents wait. */
export interface BrainNextReviewBaseProps {
    readonly props: {
        /** The line's text; an empty slot while none waits. */
        readonly slot: DataSlot<string>
        readonly labels: SlotLabels
        readonly href: string
    }
    readonly on: { readonly retry: () => void }
}

/** Draws the one line that says what to do next after documents came in. */
export const BrainNextReviewBase = (props: BrainNextReviewBaseProps) => (
    <SlotView
        slot={props.props.slot}
        placeholder=""
        labels={props.props.labels}
        forbidden="hide"
        empty="collapse"
        onRetry={props.on.retry}
        render={(label, isLoading) => (
            <Text isLoading={isLoading}>
                <Link href={props.props.href} isDisabled={isLoading}>
                    {label}
                </Link>
            </Text>
        )}
    />
)
