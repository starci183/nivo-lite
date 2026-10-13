import { Button, Form, Textarea } from "@starci/grammar/common"
import { LoyaltyField } from "@/components/leaves/LoyaltyField"
import { FORM_CLASS_NAME } from "./classNames"

/** What the member details form draws and reports. */
export interface LoyaltyMemberEditFormProps {
    readonly label: string
    readonly memberId: string
    readonly name: string
    readonly birthday: string
    readonly note: string
    readonly nameError?: string
    readonly birthdayError?: string
    readonly nameLabel: string
    readonly birthdayLabel: string
    readonly birthdayPlaceholder: string
    readonly birthdayHint: string
    readonly noteLabel: string
    readonly noteMax: number
    readonly saveLabel: string
    readonly isPending: boolean
    readonly onName: (value: string) => void
    readonly onBirthday: (value: string) => void
    readonly onNote: (value: string) => void
    readonly onSubmit: () => void
}

/** The member details form for managers: name, birthday and note over one save button. */
export const LoyaltyMemberEditForm = (props: LoyaltyMemberEditFormProps) => (
    <Form label={props.label} onSubmit={props.onSubmit} isPending={props.isPending}>
        <div className={FORM_CLASS_NAME}>
            <LoyaltyField
                id={`member-name-${props.memberId}`}
                name="name"
                label={props.nameLabel}
                value={props.name}
                isRequired
                isDisabled={props.isPending}
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
                {...(props.birthdayError === undefined ? {} : { error: props.birthdayError })}
                onChange={props.onBirthday}
            />
            <Textarea
                label={props.noteLabel}
                variant="secondary"
                rows={2}
                maxLength={props.noteMax}
                value={props.note}
                isDisabled={props.isPending}
                onValueChange={props.onNote}
            />
            <div>
                <Button type="submit" variant="secondary" isPending={props.isPending}>
                    {props.saveLabel}
                </Button>
            </div>
        </div>
    </Form>
)
