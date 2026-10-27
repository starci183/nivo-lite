import { SurfaceCard } from "@starci/grammar/common"
import { SlotBoundView } from "@/components/composites/SlotView"
import { WaitingLines } from "@/components/composites/WaitingLines"
import type { WaitingLine } from "@/components/composites/WaitingLines"
import type { DataSlot, SlotLabels } from "@/modules/types"

/** The waiting lines the redirect draws while the target is found. */
export type AgentRecordRedirectLines = ReadonlyArray<WaitingLine>

/** Copy and slot of the waiting state. */
export interface AgentRecordRedirectBaseProps {
    readonly props: {
        readonly label: string
        readonly slot: DataSlot<AgentRecordRedirectLines>
        readonly placeholder: AgentRecordRedirectLines
        readonly slotLabels: SlotLabels
    }
}

/** Draws waiting lines while the instance of an old agent url is found. */
export const AgentRecordRedirectBase = (props: AgentRecordRedirectBaseProps) => (
    <SurfaceCard ariaLabel={props.props.label}>
        <SlotBoundView from={props.props}>
            {(rows, isSkeleton) => <WaitingLines rows={rows} isSkeleton={isSkeleton} />}
        </SlotBoundView>
    </SurfaceCard>
)
