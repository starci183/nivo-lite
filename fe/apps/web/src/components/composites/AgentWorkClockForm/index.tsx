import { Button, Input, Select, Cluster, Stack } from "@starci/grammar/common"
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
    readonly canAdd: boolean
    readonly isSaving: boolean
    readonly isLoading: boolean
    readonly onPreset: (value: string | null) => void
    readonly onTime: (value: string) => void
    readonly onAdd: () => void
}

/** The preset, the time of day when the preset has one, and the command that adds a clock. */
export const AgentWorkClockForm = (props: AgentWorkClockFormProps) => (
    <Cluster gap="inline" align="end">
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
        <Button
            intent="neutral"
            isLoading={props.isLoading}
            isPending={props.isSaving}
            isDisabled={!props.canAdd}
            onPress={props.onAdd}
        >
            {props.addLabel}
        </Button>
    </Cluster>
)
