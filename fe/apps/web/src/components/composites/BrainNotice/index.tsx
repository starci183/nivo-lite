import { PaneSection, SurfaceCard } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { DataSlot, SlotLabels } from "@/modules/types"

/** What the notice that takes the whole page draws. */
interface BrainNoticeProps<T> {
    /** Names the card that holds the notice, for assistive technology. */
    readonly ariaLabel: string
    readonly slot: DataSlot<ReadonlyArray<T>>
    readonly placeholder: ReadonlyArray<T>
    readonly labels: SlotLabels
    readonly errorBody: string
    readonly emptyBody: string
    /** The one action that answers an empty page; absent where the member may not write. */
    readonly emptyAction?: { readonly label: string; readonly onAction: () => void }
    readonly onRetry: () => void
}

/**
 * The notice that takes the whole page: nothing is there yet (and the way to add the first), or the page did not read (and its retry).
 * It stands in one white card on the page's well, like the empty card of every other page (the well is the only pink part).
 */
export const BrainNotice = <T,>(props: BrainNoticeProps<T>) => (
    <PaneSection>
        <SurfaceCard ariaLabel={props.ariaLabel}>
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
        </SurfaceCard>
    </PaneSection>
)
