import { Button, Input, Select } from "@starci/grammar/common"
import { FORM_GROW, FORM_ROW } from "./classNames"

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
    readonly isSkeleton: boolean
    readonly onPreset: (value: string | null) => void
    readonly onTime: (value: string) => void
    readonly onAdd: () => void
}

/** The preset, the time of day when the preset has one, and the command that adds a clock. */
export const AgentWorkClockForm = (props: AgentWorkClockFormProps) => (
    <div className={FORM_ROW}>
        <div className={FORM_GROW}>
            <Select
                label={props.presetLabel}
                options={[...props.presetOptions]}
                value={props.preset}
                isSkeleton={props.isSkeleton}
                isDisabled={props.isSaving}
                onValueChange={props.onPreset}
            />
        </div>
        {props.needsTime ? (
            <div className={FORM_GROW}>
                <Input
                    id="agent-work-time"
                    name="time"
                    label={props.timeLabel}
                    placeholder={props.timePlaceholder}
                    value={props.atTime}
                    isError={props.isTimeInvalid}
                    errorMessage={props.isTimeInvalid ? props.timeInvalid : undefined}
                    isSkeleton={props.isSkeleton}
                    isDisabled={props.isSaving}
                    onValueChange={props.onTime}
                />
            </div>
        ) : null}
        <Button
            intent="neutral"
            isSkeleton={props.isSkeleton}
            isPending={props.isSaving}
            isDisabled={!props.canAdd}
            onPress={props.onAdd}
        >
            {props.addLabel}
        </Button>
    </div>
)
