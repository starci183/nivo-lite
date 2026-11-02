import type { LoyaltyViews, LoyaltyActions } from "@/modules/types"
import { Button, Form, Input, Select, Switch, Textarea, Stack, Grid, Cluster } from "@starci/grammar/common"

/** What the add and edit form of one reward draws and reports. */
type RewardEditorData = LoyaltyViews["rewardEditor"]
/** The existing native presentation contract, with pure fields and actions owned separately. */
interface LoyaltyRewardFormProps extends RewardEditorData {
    readonly isLoading?: boolean
    readonly onChange: LoyaltyActions["rewards"]["change"]
    readonly onActive: LoyaltyActions["rewards"]["setActive"]
    readonly onSubmit: LoyaltyActions["rewards"]["submit"]
    readonly onCancel: LoyaltyActions["rewards"]["cancelForm"]
}

/** The fields of one reward with its save and cancel buttons; the percent field shows for percent rewards only. */
export const LoyaltyRewardForm = (props: LoyaltyRewardFormProps) => (
    <Form label={props.heading} isPending={props.isPending} onSubmit={props.onSubmit}>
        <Stack gap="row">
            <Input
                id="reward-name"
                name="name"
                label={props.nameLabel}
                isRequired
                isInvalid={props.nameError !== undefined}
                errorMessage={props.nameError}
                value={props.values.name}
                isDisabled={props.isPending}
                isLoading={props.isLoading ?? false}
                onValueChange={(value) => props.onChange("name", value)}
            />
            {renderLoyaltyRewardFormKindFields(props)}
            {renderLoyaltyRewardFormValueFields(props)}
            <Grid kind="form" columns={2}>
                <Input
                    id="reward-stock"
                    name="stock"
                    label={props.stockLabel}
                    description={props.stockHint}
                    value={props.values.stock}
                    isDisabled={props.isPending}
                    isLoading={props.isLoading ?? false}
                    onValueChange={(value) => props.onChange("stock", value)}
                />
                <Input
                    id="reward-limit"
                    name="limit"
                    label={props.limitLabel}
                    description={props.limitHint}
                    value={props.values.limit}
                    isDisabled={props.isPending}
                    isLoading={props.isLoading ?? false}
                    onValueChange={(value) => props.onChange("limit", value)}
                />
            </Grid>
            <Select
                label={props.minTierLabel}
                options={props.tierOptions}
                value={props.values.minTier}
                isDisabled={props.isPending}
                isLoading={props.isLoading ?? false}
                onValueChange={(value) => props.onChange("minTier", value ?? "")}
            />
            <Textarea
                label={props.noteLabel}
                rows={2}
                maxLength={props.noteMax}
                value={props.values.note}
                isDisabled={props.isPending}
                isLoading={props.isLoading ?? false}
                onValueChange={(value) => props.onChange("note", value)}
            />
            <Switch
                label={props.activeLabel}
                isSelected={props.values.active}
                isDisabled={props.isPending}
                isLoading={props.isLoading ?? false}
                onSelectedChange={(active) => props.onActive(active)}
            />
            <Cluster gap="inline">
                <Button type="submit" intent="commit" isPending={props.isPending} isLoading={props.isLoading ?? false}>
                    {props.saveLabel}
                </Button>
                <Button
                    intent="neutral"
                    isDisabled={props.isPending}
                    isLoading={props.isLoading ?? false}
                    onPress={props.onCancel}
                >
                    {props.cancelLabel}
                </Button>
            </Cluster>
        </Stack>
    </Form>
)

/** Renders the LoyaltyRewardForm value fields section. */
const renderLoyaltyRewardFormValueFields = (
    props: Pick<
        LoyaltyRewardFormProps,
        "valueLabel" | "valueHint" | "values" | "isPending" | "isLoading" | "onChange" | "percentLabel"
    >,
) => (
    <Grid kind="form" columns={2}>
        <Input
            id="reward-value"
            name="value"
            label={props.valueLabel}
            description={props.valueHint}
            value={props.values.value}
            isDisabled={props.isPending}
            isLoading={props.isLoading ?? false}
            onValueChange={(value) => props.onChange("value", value)}
        />
        {props.values.kind === "percent" ? (
            <Input
                id="reward-percent"
                name="percent"
                label={props.percentLabel}
                value={props.values.percent}
                isDisabled={props.isPending}
                isLoading={props.isLoading ?? false}
                onValueChange={(value) => props.onChange("percent", value)}
            />
        ) : null}
    </Grid>
)

/** Renders the LoyaltyRewardForm kind fields section. */
const renderLoyaltyRewardFormKindFields = (
    props: Pick<
        LoyaltyRewardFormProps,
        "kindLabel" | "kindOptions" | "values" | "isPending" | "isLoading" | "onChange" | "costLabel" | "costError"
    >,
) => (
    <Grid kind="form" columns={2}>
        <Select
            label={props.kindLabel}
            options={props.kindOptions}
            value={props.values.kind}
            isDisabled={props.isPending}
            isLoading={props.isLoading ?? false}
            onValueChange={(value) => props.onChange("kind", value ?? "")}
        />
        <Input
            id="reward-cost"
            name="cost"
            label={props.costLabel}
            isRequired
            isInvalid={props.costError !== undefined}
            errorMessage={props.costError}
            value={props.values.cost}
            isDisabled={props.isPending}
            isLoading={props.isLoading ?? false}
            onValueChange={(value) => props.onChange("cost", value)}
        />
    </Grid>
)
