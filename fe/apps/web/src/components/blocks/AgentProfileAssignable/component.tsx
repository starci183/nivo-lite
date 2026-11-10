import { Badge, Cluster } from "@starci/grammar/common"
import { FieldBlock, fieldFrameOf } from "@/components/frames/FieldBlock"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import type { DataSlot, SlotLabels } from "@/modules/types"

/** One role or room whose members may hand the agent work. */
export interface AssignerChip {
    readonly id: string
    readonly label: string
}

/** Copy and state of the "Ai duoc giao viec" field. */
export interface AgentProfileAssignableBaseProps {
    readonly props: {
        readonly title: string
        readonly description: string
        /** The read, its same-shape placeholder and the words of its states, as SlotView takes them. */
        readonly read: {
            readonly slot: DataSlot<ReadonlyArray<AssignerChip>>
            readonly placeholder: ReadonlyArray<AssignerChip>
            readonly labels: SlotLabels
        }
    }
    readonly on: { readonly retry: () => void }
}

/** Draws who may hand the agent work as a flat field: the title and its description on the left, the roles and rooms as chips on the right. */
export const AgentProfileAssignableBase = (props: AgentProfileAssignableBaseProps) => {
    const { title, description } = props.props
    return (
        <SlotView
            {...props.props.read}
            onRetry={props.on.retry}
            frame={fieldFrameOf(title, description)}
            render={(chips, isSkeleton) => (
                <FieldBlock
                    title={title}
                    description={description}
                    trailing={
                        <Cluster gap="inline" justify="end">
                            {chips.map((chip) => (
                                <Badge key={chip.id} tone="neutral" isLoading={isSkeleton}>
                                    {chip.label}
                                </Badge>
                            ))}
                        </Cluster>
                    }
                />
            )}
        />
    )
}
