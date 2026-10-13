import { Input } from "@starci/grammar/common"

/** The words and state of a new-password field with its confirmation. */
interface PasswordPairProps {
    readonly idPrefix: string
    readonly passwordLabel: string
    readonly confirmLabel: string
    readonly hint: string
    readonly showLabel: string
    readonly hideLabel: string
    readonly password: string
    readonly confirm: string
    readonly passwordError?: string
    readonly confirmError?: string
    readonly isDisabled: boolean
    readonly onPassword: (value: string) => void
    readonly onConfirm: (value: string) => void
}

/** A new password with a strength hint, and the field that repeats it. */
export const PasswordPair = (props: PasswordPairProps) => (
    <>
        <Input
            id={`${props.idPrefix}-password`}
            name="password"
            kind="newPassword"
            label={props.passwordLabel}
            hint={props.hint}
            revealLabel={props.showLabel}
            hideLabel={props.hideLabel}
            variant="secondary"
            isRequired
            isDisabled={props.isDisabled}
            value={props.password}
            isError={props.passwordError !== undefined}
            errorMessage={props.passwordError}
            onValueChange={props.onPassword}
        />
        <Input
            id={`${props.idPrefix}-confirm`}
            name="confirm"
            kind="newPassword"
            label={props.confirmLabel}
            revealLabel={props.showLabel}
            hideLabel={props.hideLabel}
            variant="secondary"
            isRequired
            isDisabled={props.isDisabled}
            value={props.confirm}
            isError={props.confirmError !== undefined}
            errorMessage={props.confirmError}
            onValueChange={props.onConfirm}
        />
    </>
)
