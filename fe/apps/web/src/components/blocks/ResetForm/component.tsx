import { Button, TextAction } from "@starci/grammar/common"
import { AuthForm } from "../../composites/AuthForm"
import { AuthPanel } from "../../composites/AuthPanel"
import { PasswordPair } from "../../composites/PasswordPair"
import { RESET_ACTIONS_CLASS_NAME, RESET_CENTER_CLASS_NAME } from "./classNames"

/** The words and state of the reset-password card, resolved by the connected block. */
export interface ResetFormBaseProps {
    readonly state: "form" | "expired"
    readonly props: {
        readonly title: string
        readonly text: string
        readonly failure?: { readonly title: string; readonly text: string } | undefined
        readonly newPasswordLabel: string
        readonly confirmLabel: string
        readonly passwordHint: string
        readonly showLabel: string
        readonly hideLabel: string
        readonly submitLabel: string
        readonly password: string
        readonly confirm: string
        readonly passwordError?: string | undefined
        readonly confirmError?: string | undefined
        readonly isPending: boolean
        readonly expiredTitle: string
        readonly expiredText: string
        readonly newLinkLabel: string
        readonly newLinkHref: string
        readonly backLabel: string
        readonly backHref: string
    }
    readonly on: {
        readonly setPassword: (value: string) => void
        readonly setConfirm: (value: string) => void
        readonly submit: () => void
    }
}

/** Draws the new-password card, or the "link expired" state with a way to request another. */
export const ResetFormBase = (props: ResetFormBaseProps) => {
    const view = props.props
    if (props.state === "expired") {
        return (
            <AuthPanel label={view.expiredTitle} title={view.expiredTitle} text={view.expiredText}>
                <div className={RESET_ACTIONS_CLASS_NAME}>
                    <Button intent="commit" width="fill" href={view.newLinkHref}>
                        {view.newLinkLabel}
                    </Button>
                    <div className={RESET_CENTER_CLASS_NAME}>
                        <TextAction href={view.backHref}>{view.backLabel}</TextAction>
                    </div>
                </div>
            </AuthPanel>
        )
    }
    return (
        <AuthPanel label={view.title} title={view.title} text={view.text}>
            <AuthForm
                label={view.title}
                isPending={view.isPending}
                failure={view.failure}
                submitLabel={view.submitLabel}
                onSubmit={props.on.submit}
            >
                <PasswordPair
                    idPrefix="reset"
                    passwordLabel={view.newPasswordLabel}
                    confirmLabel={view.confirmLabel}
                    hint={view.passwordHint}
                    showLabel={view.showLabel}
                    hideLabel={view.hideLabel}
                    password={view.password}
                    confirm={view.confirm}
                    passwordError={view.passwordError}
                    confirmError={view.confirmError}
                    isDisabled={view.isPending}
                    onPassword={props.on.setPassword}
                    onConfirm={props.on.setConfirm}
                />
            </AuthForm>
        </AuthPanel>
    )
}
