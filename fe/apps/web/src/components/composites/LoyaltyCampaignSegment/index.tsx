import { Checkbox, CheckboxGroup, Input } from "@starci/grammar/common"
import { CHECKS_CLASS_NAME, FIELD_PAIR_CLASS_NAME, FORM_CLASS_NAME } from "./classNames"
/** Inputs and commands for the LoyaltyCampaignSegment presentation. */
interface LoyaltyCampaignSegmentProps {
    readonly props: {
        readonly copy: {
            readonly tiers: string
            readonly tiersHint: string
            readonly inactive: string
            readonly inactiveHint: string
            readonly spend: string
            readonly spendHint: string
            readonly birthday: string
        }
        readonly tierOptions: ReadonlyArray<{ readonly value: string; readonly label: string }>
        readonly values: {
            readonly tiers: ReadonlyArray<string>
            readonly inactive: string
            readonly spend: string
            readonly birthday: boolean
        }
        readonly isBusy: boolean
    }
    readonly on: {
        readonly setTiers: (value: ReadonlyArray<string>) => void
        readonly setInactive: (value: string) => void
        readonly setSpend: (value: string) => void
        readonly setBirthday: (value: boolean) => void
    }
}

/** Audience filters for a loyalty promotion. */
export const LoyaltyCampaignSegment = (props: LoyaltyCampaignSegmentProps) => {
    const { copy, values } = props.props
    const on = props.on
    return (
        <div className={FORM_CLASS_NAME}>
            <CheckboxGroup
                label={copy.tiers}
                description={copy.tiersHint}
                orientation="horizontal"
                variant="secondary"
                options={[...props.props.tierOptions]}
                value={[...values.tiers]}
                isDisabled={props.props.isBusy}
                onValueChange={on.setTiers}
            />
            <div className={FIELD_PAIR_CLASS_NAME}>
                <Input
                    id="seg-inactive"
                    name="inactive"
                    label={copy.inactive}
                    variant="secondary"
                    hint={copy.inactiveHint}
                    placeholder="45"
                    value={values.inactive}
                    isDisabled={props.props.isBusy}
                    onValueChange={on.setInactive}
                />
                <Input
                    id="seg-spend"
                    name="spend"
                    label={copy.spend}
                    variant="secondary"
                    hint={copy.spendHint}
                    placeholder="1000000"
                    value={values.spend}
                    isDisabled={props.props.isBusy}
                    onValueChange={on.setSpend}
                />
            </div>
            <div className={CHECKS_CLASS_NAME}>
                <Checkbox
                    label={copy.birthday}
                    variant="secondary"
                    isSelected={values.birthday}
                    isDisabled={props.props.isBusy}
                    onSelectedChange={on.setBirthday}
                />
            </div>
        </div>
    )
}
