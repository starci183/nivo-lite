import { PaneSection } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { DataSlot, SlotLabels } from "@/modules/types"

/** What the notice that takes the whole page draws. */
interface BrainNoticeProps<T> {
    readonly slot: DataSlot<ReadonlyArray<T>>
    readonly placeholder: ReadonlyArray<T>
    readonly labels: SlotLabels
    readonly errorBody: string
    readonly emptyBody: string
    /** The one action that answers an empty page; absent where the member may not write. */
    readonly emptyAction?: { readonly label: string; readonly onAction: () => void }
    readonly onRetry: () => void
}

/** The notice that takes the whole page: nothing is there yet (and the way to add the first), or the page did not read (and its retry). */
export const BrainNotice = <T,>(props: BrainNoticeProps<T>) => (
    <PaneSection align="center" grow>
        <SlotView
            slot={props.slot}
            placeholder={props.placeholder}
            labels={props.labels}
            errorDescription={props.errorBody}
            emptyDescription={props.emptyBody}
            emptyIconSource={nivoIconSource("brain", "leading")}
            {...(props.emptyAction === undefined ? {} : { emptyAction: props.emptyAction })}
            onRetry={props.onRetry}
            render={() => null}
        />
    </PaneSection>
)
