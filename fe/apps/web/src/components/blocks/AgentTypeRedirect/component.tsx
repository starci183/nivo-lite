import { SurfaceCard } from "@starci/grammar/common"
import { SlotBoundView } from "@/components/composites/SlotView"
import { WaitingLines } from "@/components/composites/WaitingLines"
import type { WaitingLine } from "@/components/composites/WaitingLines"
import type { DataSlot, SlotLabels } from "@/modules/types"

/** The waiting lines the redirect draws while the target is found. */
export type AgentTypeRedirectLines = ReadonlyArray<WaitingLine>

/** Copy and slot of the waiting state. */
export interface AgentTypeRedirectBaseProps {
    readonly props: {
        readonly label: string
        readonly slot: DataSlot<AgentTypeRedirectLines>
        readonly placeholder: AgentTypeRedirectLines
        readonly slotLabels: SlotLabels
    }
}

/** Draws waiting lines while the redirect of an old tab url is decided. */
export const AgentTypeRedirectBase = (props: AgentTypeRedirectBaseProps) => (
    <SurfaceCard ariaLabel={props.props.label}>
        <SlotBoundView from={props.props}>
            {(rows, isSkeleton) => <WaitingLines rows={rows} isSkeleton={isSkeleton} />}
        </SlotBoundView>
    </SurfaceCard>
)
