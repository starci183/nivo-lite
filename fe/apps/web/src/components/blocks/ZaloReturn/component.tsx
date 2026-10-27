import { Text } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels } from "@/modules/types"
import { WAIT_CLASS_NAME } from "./classNames"

/** The text and the hand-over the connected block supplies. */
export interface ZaloReturnBaseProps {
    readonly props: {
        readonly waiting: string
        /** The address the browser lands on once the back end took the return. */
        readonly landing: DataSlot<string>
        readonly slotLabels: SlotLabels
    }
    readonly on: {
        readonly retry: () => void
    }
}

/** Draws the line shown while the Zalo return is handed to the back end. */
export const ZaloReturnBase = (props: ZaloReturnBaseProps) => (
    <div className={WAIT_CLASS_NAME}>
        <SlotView slot={props.props.landing} placeholder="" labels={props.props.slotLabels} onRetry={props.on.retry}>
            {() => (
                <output>
                    <Text as="span" tone="muted">
                        {props.props.waiting}
                    </Text>
                </output>
            )}
        </SlotView>
    </div>
)
