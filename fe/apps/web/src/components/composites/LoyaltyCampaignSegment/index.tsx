import type { LoyaltyViews, LoyaltyActions } from "@/modules/types"
import { Checkbox, CheckboxGroup, Input, Stack, Grid, Cluster } from "@starci/grammar/common"
/** Inputs and commands for the LoyaltyCampaignSegment presentation. */
type PromotionData = LoyaltyViews["promotion"]
interface LoyaltyCampaignSegmentProps {
    readonly isLoading?: boolean
    readonly copy: Pick<
        PromotionData["copy"],
        "tiers" | "tiersHint" | "inactive" | "inactiveHint" | "spend" | "spendHint" | "birthday"
    >
    readonly tierOptions: PromotionData["tierOptions"]
    readonly values: Pick<PromotionData["values"], "tiers" | "inactive" | "spend" | "birthday">
    readonly isBusy: boolean
    readonly on: Pick<LoyaltyActions["promotion"], "setTiers" | "setInactive" | "setSpend" | "setBirthday">
}

/** Audience filters for a loyalty promotion. */
export const LoyaltyCampaignSegment = (props: LoyaltyCampaignSegmentProps) => {
    const { copy, values } = props
    const on = props.on
    return (
        <Stack gap="row">
            <CheckboxGroup
                label={copy.tiers}
                description={copy.tiersHint}
                orientation="horizontal"
                options={[...props.tierOptions]}
                value={[...values.tiers]}
                isDisabled={props.isBusy}
                isLoading={props.isLoading ?? false}
                onValueChange={on.setTiers}
            />
            <Grid kind="form" columns={2}>
                <Input
                    id="seg-inactive"
                    name="inactive"
                    label={copy.inactive}
                    description={copy.inactiveHint}
                    placeholder="45"
                    value={values.inactive}
                    isDisabled={props.isBusy}
                    isLoading={props.isLoading ?? false}
                    onValueChange={on.setInactive}
                />
                <Input
                    id="seg-spend"
                    name="spend"
                    label={copy.spend}
                    description={copy.spendHint}
                    placeholder="1000000"
                    value={values.spend}
                    isDisabled={props.isBusy}
                    isLoading={props.isLoading ?? false}
                    onValueChange={on.setSpend}
                />
            </Grid>
            <Cluster gap="row">
                <Checkbox
                    isLoading={props.isLoading ?? false}
                    label={copy.birthday}
                    isSelected={values.birthday}
                    isDisabled={props.isBusy}
                    onSelectedChange={on.setBirthday}
                />
            </Cluster>
        </Stack>
    )
}
