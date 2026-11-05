import type { ReactNode } from "react"
import type { LoyaltyViews, LoyaltyActions } from "../types"
import { Button, Form, Stack, Textarea } from "@starci/grammar/common"
import { LoyaltyField } from "./LoyaltyField"

/** What the member details form draws and reports. */
type MemberEditData = LoyaltyViews["memberEdit"]
type MemberEditOn = LoyaltyActions["memberEdit"]
/** The existing native presentation contract, with pure fields and actions owned separately. */
interface LoyaltyMemberEditFormProps extends MemberEditData, MemberEditOn {
    readonly isLoading: boolean
}

/** The member details form for managers: name, birthday and note over one save button. */
export const LoyaltyMemberEditForm = (props: LoyaltyMemberEditFormProps): ReactNode => (
    <Form label={props.label} onSubmit={props.onSubmit} isPending={props.isPending}>
        <Stack gap="row">
            <LoyaltyField
                id={`member-name-${props.memberId}`}
                name="name"
                label={props.nameLabel}
                value={props.name}
                isRequired
                isDisabled={props.isPending}
                isLoading={props.isLoading}
                {...(props.nameError === undefined ? {} : { error: props.nameError })}
                onChange={props.onName}
            />
            <LoyaltyField
                id={`member-birthday-${props.memberId}`}
                name="birthday"
                label={props.birthdayLabel}
                value={props.birthday}
                placeholder={props.birthdayPlaceholder}
                hint={props.birthdayHint}
                isRequired={false}
                isDisabled={props.isPending}
                isLoading={props.isLoading}
                {...(props.birthdayError === undefined ? {} : { error: props.birthdayError })}
                onChange={props.onBirthday}
            />
            <Textarea
                label={props.noteLabel}
                rows={2}
                maxLength={props.noteMax}
                value={props.note}
                isDisabled={props.isPending}
                isLoading={props.isLoading}
                onValueChange={props.onNote}
            />
            <div>
                <Button type="submit" intent="neutral" isPending={props.isPending} isLoading={props.isLoading}>
                    {props.saveLabel}
                </Button>
            </div>
        </Stack>
    </Form>
)
