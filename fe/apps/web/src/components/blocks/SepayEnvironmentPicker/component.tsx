import { RadioGroup } from "@starci/grammar/common"
import { ConnectionStepBand } from "@/components/frames/ConnectionStepBand"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import type { DataSlot, SepayEnvironment, SlotLabels } from "@/modules/types"

/** The selected environment and the authority to change it, from the connection's own read. */
export interface SepayEnvironmentView {
    readonly value: SepayEnvironment
    readonly description: string
    readonly isDisabled: boolean
}

/** The connection's environment region and resolved choice copy. */
export interface SepayEnvironmentPickerBaseProps {
    readonly props: {
        /** The step's band: its place, words and whether it is open. */
        readonly step: {
            readonly ordinal: number
            readonly title: string
            readonly summary: string
            readonly hint: string
            readonly isOpen: boolean
        }
        readonly label: string
        readonly options: ReadonlyArray<{ readonly value: SepayEnvironment; readonly label: string }>
        readonly slot: DataSlot<SepayEnvironmentView>
        readonly placeholder: SepayEnvironmentView
        readonly slotLabels: SlotLabels
    }
    readonly on: {
        readonly change: (environment: SepayEnvironment) => void
        readonly retry: () => void
        readonly toggle: (isOpen: boolean) => void
    }
}

/** Keeps test/live as a controlled value field, with read failure and loading in its own region. */
export const SepayEnvironmentPickerBase = (props: SepayEnvironmentPickerBaseProps) => (
    <ConnectionStepBand {...props.props.step} onToggle={props.on.toggle}>
        <SlotView
            slot={props.props.slot}
            placeholder={props.props.placeholder}
            labels={props.props.slotLabels}
            onRetry={props.on.retry}
            render={(view, isLoading) => (
                <RadioGroup
                    orientation="horizontal"
                    label={props.props.label}
                    isLabelHidden
                    description={view.description}
                    options={props.props.options}
                    value={view.value}
                    isDisabled={view.isDisabled}
                    isLoading={isLoading}
                    onValueChange={(value) => {
                        const picked = props.props.options.find((option) => option.value === value)
                        if (picked !== undefined && picked.value !== view.value) props.on.change(picked.value)
                    }}
                />
            )}
        />
    </ConnectionStepBand>
)
