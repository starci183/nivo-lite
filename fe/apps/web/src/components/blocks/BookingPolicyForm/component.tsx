import { Checkbox, Form, Input, NumberField } from "@starci/grammar/common"
import { BookingSaveLine } from "@/components/composites/BookingSaveLine"
import { BookingSetupSection } from "@/components/composites/BookingSetupSection"
import { GRID_CLASS, STACK_CLASS, WIDE_CLASS } from "./classNames"

/** One numeric rule of the policy. */
export interface RuleView {
    readonly id: string
    readonly label: string
    readonly value: number
}

/** Props for {@link BookingPolicyFormBase}. */
export interface BookingPolicyFormBaseProps {
    readonly props: {
        readonly title: string
        readonly hint: string
        readonly rules: ReadonlyArray<RuleView>
        readonly addressLabel: string
        readonly address: string
        readonly autoConfirmLabel: string
        readonly autoConfirm: boolean
        readonly handoffLabel: string
        readonly handoff: boolean
        readonly saveLabel: string
        readonly isPending: boolean
        readonly notice?: { readonly tone: "affirmative" | "negative"; readonly text: string }
    }
    readonly on: {
        readonly changeRule: (id: string, value: number) => void
        readonly changeAddress: (value: string) => void
        readonly toggleAutoConfirm: (value: boolean) => void
        readonly toggleHandoff: (value: boolean) => void
        readonly save: () => void
    }
}

/** Draws the booking policy form: cancellation window, deposit, fees, slot rules and the two switches. */
export const BookingPolicyFormBase = (props: BookingPolicyFormBaseProps) => {
    const { props: p, on } = props
    return (
        <BookingSetupSection title={p.title} hint={p.hint}>
            <Form label={p.title} isPending={p.isPending} onSubmit={on.save}>
                <div className={STACK_CLASS}>
                    <div className={GRID_CLASS}>
                        {p.rules.map((rule) => (
                            <NumberField
                                key={rule.id}
                                label={rule.label}
                                variant="secondary"
                                minValue={0}
                                step={1}
                                value={rule.value}
                                onValueChange={(value) => on.changeRule(rule.id, value)}
                            />
                        ))}
                        <div className={WIDE_CLASS}>
                            <Input
                                id="booking-policy-address"
                                name="address"
                                label={p.addressLabel}
                                variant="secondary"
                                value={p.address}
                                onValueChange={on.changeAddress}
                            />
                        </div>
                    </div>
                    <Checkbox
                        variant="secondary"
                        label={p.autoConfirmLabel}
                        isSelected={p.autoConfirm}
                        onSelectedChange={on.toggleAutoConfirm}
                    />
                    <Checkbox
                        variant="secondary"
                        label={p.handoffLabel}
                        isSelected={p.handoff}
                        onSelectedChange={on.toggleHandoff}
                    />
                    <BookingSaveLine
                        label={p.saveLabel}
                        isPending={p.isPending}
                        {...(p.notice === undefined ? {} : { notice: p.notice })}
                    />
                </div>
            </Form>
        </BookingSetupSection>
    )
}
