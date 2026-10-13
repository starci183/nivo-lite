import { Select, Switch } from "@starci/grammar/common"
import { LoyaltySettingsSection } from "@/components/leaves/LoyaltySettingsSection"
import { LoyaltyField } from "@/components/leaves/LoyaltyField"
import type { ProgramTextField } from "@/hooks/loyaltyProgramFields"
import { FIELD_PAIR_CLASS_NAME } from "./classNames"

/** What the birthday section of the programme settings draws and reports. */
type LoyaltyBirthdaySectionProps = {
    readonly title: string
    readonly isOn: boolean
    readonly points: string
    readonly rewardKey: string
    readonly note: string
    readonly isDisabled: boolean
    readonly rewardOptions: ReadonlyArray<{ readonly id: string; readonly label: string }>
    readonly onLabel: string
    readonly pointsLabel: string
    readonly rewardLabel: string
    readonly noteLabel: string
    readonly noteHint: string
    readonly onToggle: (isOn: boolean) => void
    readonly onChange: (field: ProgramTextField, value: string) => void
}

/** The birthday gift: a switch, the bonus points, the reward and the note of the message; the fields wait for the switch. */
export const LoyaltyBirthdaySection = (props: LoyaltyBirthdaySectionProps) => (
    <LoyaltySettingsSection title={props.title}>
        <Switch
            label={props.onLabel}
            isSelected={props.isOn}
            isDisabled={props.isDisabled}
            onSelectedChange={props.onToggle}
        />
        <div className={FIELD_PAIR_CLASS_NAME}>
            <LoyaltyField
                id="lp-birthday-points"
                label={props.pointsLabel}
                value={props.points}
                isDisabled={props.isDisabled || !props.isOn}
                onChange={(value) => props.onChange("birthdayPoints", value)}
            />
            <Select
                label={props.rewardLabel}
                variant="secondary"
                options={props.rewardOptions}
                value={props.rewardKey === "" ? "none" : props.rewardKey}
                isDisabled={props.isDisabled || !props.isOn}
                onValueChange={(value) => props.onChange("birthdayReward", value ?? "")}
            />
        </div>
        <LoyaltyField
            id="lp-birthday-note"
            label={props.noteLabel}
            hint={props.noteHint}
            value={props.note}
            isDisabled={props.isDisabled || !props.isOn}
            onChange={(value) => props.onChange("birthdayNote", value)}
        />
    </LoyaltySettingsSection>
)
