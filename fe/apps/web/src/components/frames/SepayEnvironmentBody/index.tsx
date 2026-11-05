import { ChoiceChips, EmptyNotice, Stack, Text } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import type { DataSlot, SepayEnvironment, SlotLabels } from "@/modules/types"

/** The selected environment and the authority to change it, from the connection own read. */
interface SepayEnvironmentView {
    readonly value: SepayEnvironment
    readonly description: string
    readonly isDisabled: boolean
}

/** The environment choice of the first setup step and its resolved copy. */
export interface SepayEnvironmentBodyProps {
    readonly props: {
        readonly label: string
        readonly options: ReadonlyArray<{ readonly value: SepayEnvironment; readonly label: string }>
        readonly slot: DataSlot<SepayEnvironmentView>
        readonly placeholder: SepayEnvironmentView
        readonly slotLabels: SlotLabels
    }
    readonly on: {
        readonly change: (environment: SepayEnvironment) => void
        readonly retry: () => void
    }
}

/** Keeps test or live as a controlled value field, with read failure and loading in its own region. */
export const SepayEnvironmentBody = (props: SepayEnvironmentBodyProps) => (
    <SlotView
        slot={props.props.slot}
        placeholder={props.props.placeholder}
        labels={props.props.slotLabels}
        onRetry={props.on.retry}
        render={(view, isLoading) => (
            <Stack gap="row">
                <Text size="sm" tone="muted" isLoading={isLoading}>
                    {view.description}
                </Text>
                <ChoiceChips
                    label={props.props.label}
                    isLabelHidden
                    empty={<EmptyNotice message={props.props.slotLabels.empty} />}
                    options={props.props.options.map((option) => ({
                        value: option.value,
                        label: option.label,
                        isDisabled: view.isDisabled,
                    }))}
                    value={view.value}
                    isLoading={isLoading}
                    onValueChange={(value) => {
                        const picked = props.props.options.find((option) => option.value === value)
                        if (picked !== undefined && picked.value !== view.value) props.on.change(picked.value)
                    }}
                />
            </Stack>
        )}
    />
)
