import { DescriptionList, SurfaceCard, Text } from "@starci/grammar/common"
import { SlotBoundView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels } from "@/modules/types"
import { STACK_CLASS } from "./classNames"

/** One group of assigners: the roles, or the rooms. */
export interface AssignerRow {
    readonly id: string
    readonly term: string
    readonly description: string
}

/** Copy and state of the "Ai duoc giao viec cho agent" card. */
export interface AgentProfileAssignableBaseProps {
    readonly props: {
        readonly title: string
        readonly description: string
        readonly slot: DataSlot<ReadonlyArray<AssignerRow>>
        readonly placeholder: ReadonlyArray<AssignerRow>
        readonly slotLabels: SlotLabels
    }
    readonly on: { readonly retry: () => void }
}

/** Draws the roles and the department rooms whose members may hand the agent work. */
export const AgentProfileAssignableBase = (props: AgentProfileAssignableBaseProps) => (
    <SurfaceCard label={props.props.title} headingLevel={2}>
        <div className={STACK_CLASS}>
            <Text size="sm" tone="muted">
                {props.props.description}
            </Text>
            <SlotBoundView from={props.props} onRetry={props.on.retry}>
                {(rows, isSkeleton) => <DescriptionList layout="stacked" isLoading={isSkeleton} items={rows} />}
            </SlotBoundView>
        </div>
    </SurfaceCard>
)
