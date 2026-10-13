import { Button, Form, Text } from "@starci/grammar/common"
import { LoyaltyField } from "@/components/leaves/LoyaltyField"
import { FORM_CLASS_NAME } from "./classNames"

/** What the point adjustment form draws and reports. */
export interface LoyaltyMemberAdjustFormProps {
    readonly label: string
    readonly memberId: string
    readonly points: string
    readonly reason: string
    readonly pointsError?: string
    readonly pointsLabel: string
    readonly pointsHint: string
    readonly pointsPlaceholder: string
    readonly reasonLabel: string
    readonly submitLabel: string
    readonly canSubmit: boolean
    readonly note?: string
    readonly isPending: boolean
    readonly onPoints: (value: string) => void
    readonly onReason: (value: string) => void
    readonly onSubmit: () => void
}

/** The point adjustment form: a signed number and a required reason; a line says whether it was recorded or waits. */
export const LoyaltyMemberAdjustForm = (props: LoyaltyMemberAdjustFormProps) => (
    <Form label={props.label} onSubmit={props.onSubmit} isPending={props.isPending}>
        <div className={FORM_CLASS_NAME}>
            <LoyaltyField
                hint={props.pointsHint}
                placeholder={props.pointsPlaceholder}
                {...(props.pointsError === undefined ? {} : { error: props.pointsError })}
                onChange={props.onPoints}
                isDisabled={props.isPending}
                isRequired
                value={props.points}
                label={props.pointsLabel}
                name="points"
                id={`adjust-points-${props.memberId}`}
            />
            <LoyaltyField
                id={`adjust-reason-${props.memberId}`}
                name="reason"
                label={props.reasonLabel}
                value={props.reason}
                isRequired
                isDisabled={props.isPending}
                onChange={props.onReason}
            />
            <div>
                <Button type="submit" variant="secondary" isPending={props.isPending} isDisabled={!props.canSubmit}>
                    {props.submitLabel}
                </Button>
            </div>
            <div aria-live="polite">
                {props.note === undefined ? null : (
                    <Text size="sm" weight="medium">
                        {props.note}
                    </Text>
                )}
            </div>
        </div>
    </Form>
)
