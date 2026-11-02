import { SegmentedControl, Text } from "@starci/grammar/common"
import type { TelegramUserWizardCopy } from "@/modules/types"

/** The settled sync frequency and its resolved explanation. */
interface TelegramUserScheduleStepProps {
    readonly every: string
    readonly isLoading: boolean
    readonly text: Pick<
        TelegramUserWizardCopy,
        "scheduleLabel" | "scheduleManual" | "schedule15" | "schedule60" | "scheduleHint"
    >
    readonly onChange: (value: string) => void
}

/** Draws the same manual, fifteen-minute and hourly sync options. */
export const TelegramUserScheduleStep = (props: TelegramUserScheduleStepProps) => (
    <>
        <SegmentedControl
            label={props.text.scheduleLabel}
            isLoading={props.isLoading}
            value={props.every}
            width="fill"
            options={[
                { value: "0", label: props.text.scheduleManual },
                { value: "15", label: props.text.schedule15 },
                { value: "60", label: props.text.schedule60 },
            ]}
            onValueChange={props.onChange}
        />
        <Text size="sm" tone="muted">
            {props.text.scheduleHint}
        </Text>
    </>
)
