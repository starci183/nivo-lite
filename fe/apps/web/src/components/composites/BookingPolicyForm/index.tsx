import type { BookingPolicyData, BookingPolicyActions } from "@/modules/types"
import { Checkbox, Form, Input, NumberField, Stack, Grid } from "@starci/grammar/common"
import { BookingSaveLine } from "@/components/branches/BookingSaveLine"
import { WIDE_CLASS } from "./classNames"

type ReadyProps = Omit<BookingPolicyData, "hint">

/** Resolved BookingPolicyForm fields and atomic commands; read status remains in its owning workbench. */
type BookingPolicyFormProps = ReadyProps & {
    readonly isLoading: boolean
    readonly onChangeRule: BookingPolicyActions["onChangeRule"]
    readonly onChangeAddress: BookingPolicyActions["onChangeAddress"]
    readonly onToggleAutoConfirm: BookingPolicyActions["onToggleAutoConfirm"]
    readonly onToggleHandoff: BookingPolicyActions["onToggleHandoff"]
    readonly onSave: BookingPolicyActions["onSave"]
}

/** Draws the booking policy form: cancellation window, deposit, fees, slot rules and the two switches. */
export const BookingPolicyForm = (props: BookingPolicyFormProps) => {
    const on = {
        changeRule: props.onChangeRule,
        changeAddress: props.onChangeAddress,
        toggleAutoConfirm: props.onToggleAutoConfirm,
        toggleHandoff: props.onToggleHandoff,
        save: props.onSave,
    }
    return (
        <>
            <Form label={props.title} isPending={props.isPending} onSubmit={on.save}>
                <Stack gap="row">
                    <Grid kind="form" columns={2}>
                        {props.rules.map((rule) => (
                            <NumberField
                                isLoading={props.isLoading}
                                key={rule.id}
                                label={rule.label}
                                minValue={0}
                                step={1}
                                value={rule.value}
                                onValueChange={(value) => on.changeRule(rule.id, value)}
                            />
                        ))}
                        <div className={WIDE_CLASS}>
                            <Input
                                isLoading={props.isLoading}
                                id="booking-policy-address"
                                name="address"
                                label={props.addressLabel}
                                value={props.address}
                                onValueChange={on.changeAddress}
                            />
                        </div>
                    </Grid>
                    <Checkbox
                        isLoading={props.isLoading}
                        label={props.autoConfirmLabel}
                        isSelected={props.autoConfirm}
                        onSelectedChange={on.toggleAutoConfirm}
                    />
                    <Checkbox
                        isLoading={props.isLoading}
                        label={props.handoffLabel}
                        isSelected={props.handoff}
                        onSelectedChange={on.toggleHandoff}
                    />
                    <BookingSaveLine isLoading={props.isLoading} label={props.saveLabel} isPending={props.isPending} />
                </Stack>
            </Form>
        </>
    )
}
