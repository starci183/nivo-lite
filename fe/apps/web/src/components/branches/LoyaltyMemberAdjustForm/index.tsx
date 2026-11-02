import type { LoyaltyViews, LoyaltyActions } from "@/modules/types"
import { Button, Form, Text, Stack } from "@starci/grammar/common"
import { LoyaltyField } from "@/components/leaves/LoyaltyField"

/** What the point adjustment form draws and reports. */
type MemberAdjustData = LoyaltyViews["memberAdjust"]
type MemberAdjustOn = LoyaltyActions["memberAdjust"]
/** The existing native presentation contract, with pure fields and actions owned separately. */
interface LoyaltyMemberAdjustFormProps extends MemberAdjustData, MemberAdjustOn {
    readonly isLoading: boolean
}

/** The point adjustment form: a signed number and a required reason; a line says whether it was recorded or waits. */
export const LoyaltyMemberAdjustForm = (props: LoyaltyMemberAdjustFormProps) => (
    <Form label={props.label} onSubmit={props.onSubmit} isPending={props.isPending}>
        <Stack gap="row">
            <LoyaltyField
                hint={props.pointsHint}
                placeholder={props.pointsPlaceholder}
                {...(props.pointsError === undefined ? {} : { error: props.pointsError })}
                onChange={props.onPoints}
                isDisabled={props.isPending}
                isLoading={props.isLoading}
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
                isLoading={props.isLoading}
                onChange={props.onReason}
            />
            <div>
                <Button
                    type="submit"
                    intent="neutral"
                    isPending={props.isPending}
                    isDisabled={!props.canSubmit}
                    isLoading={props.isLoading}
                >
                    {props.submitLabel}
                </Button>
            </div>
            <div aria-live="polite">
                {props.note === undefined ? null : (
                    <Text size="sm" isStrong>
                        {props.note}
                    </Text>
                )}
            </div>
        </Stack>
    </Form>
)
