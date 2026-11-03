import { DescriptionList, Text } from "@starci/grammar/common"
import { ConnectionStepBand } from "@/components/frames/ConnectionStepBand"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import type { DataSlot, SlotLabels, ZaloFactView } from "@/modules/types"

/** Fake rows of the same shape: the skeleton reuses the ready tree. */
const ZALO_SAVED_PLACEHOLDER: ReadonlyArray<ZaloFactView> = [
    { id: "one", label: "-", value: "-", meta: "-" },
    { id: "two", label: "-", value: "-", meta: "-" },
    { id: "three", label: "-", value: "-", meta: "-" },
]

/** Copy and slot of the first setup step: what the app keys stored. */
export interface ZaloAppStepBaseProps {
    readonly props: {
        /** The step's band: its place, words and whether it is open. */
        readonly step: {
            readonly ordinal: number
            readonly title: string
            readonly summary: string
            readonly hint: string
            readonly isOpen: boolean
        }
        readonly facts: DataSlot<ReadonlyArray<ZaloFactView>>
        readonly slotLabels: SlotLabels
    }
    readonly on: { readonly retry: () => void; readonly toggle: (isOpen: boolean) => void }
}

/** Draws the first setup step: the saved values of the app, every secret masked to its last four characters, as a description list. */
export const ZaloAppStepBase = (props: ZaloAppStepBaseProps) => (
    <ConnectionStepBand {...props.props.step} onToggle={props.on.toggle}>
        <SlotView
            slot={props.props.facts}
            placeholder={ZALO_SAVED_PLACEHOLDER}
            labels={props.props.slotLabels}
            onRetry={props.on.retry}
            render={(facts, isLoading) => (
                <DescriptionList
                    layout="columns"
                    isLoading={isLoading}
                    items={facts.map((fact) => ({
                        id: fact.id,
                        term: fact.label,
                        description: <Text isStrong>{fact.value}</Text>,
                    }))}
                />
            )}
        />
    </ConnectionStepBand>
)
