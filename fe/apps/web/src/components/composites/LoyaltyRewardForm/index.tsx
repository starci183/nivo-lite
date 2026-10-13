import { Button, Form, Input, Select, Switch, Textarea } from "@starci/grammar/common"
import type { RewardFormValues, RewardTextField } from "@/hooks/loyaltyRewards"
import { ACTIONS_CLASS_NAME, FIELD_PAIR_CLASS_NAME, FORM_CLASS_NAME } from "./classNames"

/** What the add and edit form of one reward draws and reports. */
export type LoyaltyRewardFormProps = {
    readonly heading: string
    readonly values: RewardFormValues
    readonly isPending: boolean
    readonly nameError?: string
    readonly costError?: string
    readonly kindOptions: ReadonlyArray<{ readonly id: string; readonly label: string }>
    readonly tierOptions: ReadonlyArray<{ readonly id: string; readonly label: string }>
    readonly nameLabel: string
    readonly kindLabel: string
    readonly costLabel: string
    readonly valueLabel: string
    readonly valueHint: string
    readonly percentLabel: string
    readonly stockLabel: string
    readonly stockHint: string
    readonly limitLabel: string
    readonly limitHint: string
    readonly minTierLabel: string
    readonly noteLabel: string
    readonly activeLabel: string
    readonly saveLabel: string
    readonly cancelLabel: string
    readonly noteMax: number
    readonly onChange: (field: RewardTextField, value: string) => void
    readonly onActive: (active: boolean) => void
    readonly onSubmit: () => void
    readonly onCancel: () => void
}

/** The fields of one reward with its save and cancel buttons; the percent field shows for percent rewards only. */
export const LoyaltyRewardForm = (props: LoyaltyRewardFormProps) => (
    <Form label={props.heading} isPending={props.isPending} onSubmit={props.onSubmit}>
        <div className={FORM_CLASS_NAME}>
            <Input
                id="reward-name"
                name="name"
                label={props.nameLabel}
                variant="secondary"
                isRequired
                isError={props.nameError !== undefined}
                errorMessage={props.nameError}
                value={props.values.name}
                isDisabled={props.isPending}
                onValueChange={(value) => props.onChange("name", value)}
            />
            <div className={FIELD_PAIR_CLASS_NAME}>
                <Select
                    label={props.kindLabel}
                    variant="secondary"
                    options={props.kindOptions}
                    value={props.values.kind}
                    isDisabled={props.isPending}
                    onValueChange={(value) => props.onChange("kind", value ?? "")}
                />
                <Input
                    id="reward-cost"
                    name="cost"
                    label={props.costLabel}
                    variant="secondary"
                    isRequired
                    isError={props.costError !== undefined}
                    errorMessage={props.costError}
                    value={props.values.cost}
                    isDisabled={props.isPending}
                    onValueChange={(value) => props.onChange("cost", value)}
                />
            </div>
            <div className={FIELD_PAIR_CLASS_NAME}>
                <Input
                    id="reward-value"
                    name="value"
                    label={props.valueLabel}
                    variant="secondary"
                    hint={props.valueHint}
                    value={props.values.value}
                    isDisabled={props.isPending}
                    onValueChange={(value) => props.onChange("value", value)}
                />
                {props.values.kind === "percent" ? (
                    <Input
                        id="reward-percent"
                        name="percent"
                        label={props.percentLabel}
                        variant="secondary"
                        value={props.values.percent}
                        isDisabled={props.isPending}
                        onValueChange={(value) => props.onChange("percent", value)}
                    />
                ) : null}
            </div>
            <div className={FIELD_PAIR_CLASS_NAME}>
                <Input
                    id="reward-stock"
                    name="stock"
                    label={props.stockLabel}
                    variant="secondary"
                    hint={props.stockHint}
                    value={props.values.stock}
                    isDisabled={props.isPending}
                    onValueChange={(value) => props.onChange("stock", value)}
                />
                <Input
                    id="reward-limit"
                    name="limit"
                    label={props.limitLabel}
                    variant="secondary"
                    hint={props.limitHint}
                    value={props.values.limit}
                    isDisabled={props.isPending}
                    onValueChange={(value) => props.onChange("limit", value)}
                />
            </div>
            <Select
                label={props.minTierLabel}
                variant="secondary"
                options={props.tierOptions}
                value={props.values.minTier}
                isDisabled={props.isPending}
                onValueChange={(value) => props.onChange("minTier", value ?? "")}
            />
            <Textarea
                label={props.noteLabel}
                variant="secondary"
                rows={2}
                maxLength={props.noteMax}
                value={props.values.note}
                isDisabled={props.isPending}
                onValueChange={(value) => props.onChange("note", value)}
            />
            <Switch
                label={props.activeLabel}
                isSelected={props.values.active}
                isDisabled={props.isPending}
                onSelectedChange={(active) => props.onActive(active)}
            />
            <div className={ACTIONS_CLASS_NAME}>
                <Button type="submit" variant="primary" isPending={props.isPending}>
                    {props.saveLabel}
                </Button>
                <Button variant="outline" isDisabled={props.isPending} onPress={props.onCancel}>
                    {props.cancelLabel}
                </Button>
            </div>
        </div>
    </Form>
)
