import { AgentWorkFormButtons } from "@/components/branches/AgentWorkFormButtons"
import { Input, Select, Stack } from "@starci/grammar/common"
/** The fields and command that add a clock trigger. */
interface AgentWorkClockFormProps {
    readonly presetLabel: string
    readonly presetOptions: ReadonlyArray<{ readonly id: string; readonly label: string }>
    readonly preset: string
    readonly needsTime: boolean
    readonly timeLabel: string
    readonly timePlaceholder: string
    readonly timeInvalid: string
    readonly atTime: string
    readonly isTimeInvalid: boolean
    readonly addLabel: string
    readonly cancelLabel: string
    readonly canAdd: boolean
    readonly isSaving: boolean
    readonly isLoading: boolean
    readonly onPreset: (value: string | null) => void
    readonly onTime: (value: string) => void
    readonly onAdd: () => void
    readonly onCancel: () => void
}

/** The preset, the time of day when the preset has one, and the command that adds a clock. */
export const AgentWorkClockForm = (props: AgentWorkClockFormProps) => (
    <Stack gap="row">
        <Stack gap="identity" measure="full">
            <Select
                label={props.presetLabel}
                options={[...props.presetOptions]}
                value={props.preset}
                isLoading={props.isLoading}
                isDisabled={props.isSaving}
                onValueChange={props.onPreset}
            />
        </Stack>
        {props.needsTime ? (
            <Stack gap="identity" measure="full">
                <Input
                    id="agent-work-time"
                    name="time"
                    label={props.timeLabel}
                    placeholder={props.timePlaceholder}
                    value={props.atTime}
                    isInvalid={props.isTimeInvalid}
                    errorMessage={props.isTimeInvalid ? props.timeInvalid : undefined}
                    isLoading={props.isLoading}
                    isDisabled={props.isSaving}
                    onValueChange={props.onTime}
                />
            </Stack>
        ) : null}
        <AgentWorkFormButtons
            addLabel={props.addLabel}
            cancelLabel={props.cancelLabel}
            canAdd={props.canAdd}
            isSaving={props.isSaving}
            isLoading={props.isLoading}
            onAdd={props.onAdd}
            onCancel={props.onCancel}
        />
    </Stack>
)
