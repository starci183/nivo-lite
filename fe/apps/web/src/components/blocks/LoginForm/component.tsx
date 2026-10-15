import { Alert, Button, Divider, Input, Text, TextAction } from "@starci/grammar/common"
import { AuthForm } from "../../composites/AuthForm"
import { AuthPanel } from "../../composites/AuthPanel"
import { EmailField } from "../../composites/EmailField"
import { Icon } from "@/components/leaves/Icon"
import { LOGIN_ACTIONS_CLASS_NAME, LOGIN_CENTER_CLASS_NAME, LOGIN_ROW_CLASS_NAME } from "./classNames"

/** The words and state of the sign-in card, resolved by the connected block. */
export interface LoginFormBaseProps {
    readonly props: {
        readonly title: string
        readonly text: string
        readonly failedTitle: string
        readonly resendLabel: string
        readonly googleLabel: string
        readonly orLabel: string
        readonly emailLabel: string
        readonly emailPlaceholder: string
        readonly passwordLabel: string
        readonly showLabel: string
        readonly hideLabel: string
        readonly forgotLabel: string
        readonly forgotHref: string
        readonly submitLabel: string
        readonly noAccountLabel: string
        readonly signUpLabel: string
        readonly signUpHref: string
        readonly email: string
        readonly password: string
        readonly emailError?: string
        readonly passwordError?: string
        /** Friendly, already translated failure. */
        readonly error?: string
        readonly notice?: string
        /** True when the failure is "email not confirmed": offer to resend. */
        readonly canResend: boolean
        readonly isPasswordPending: boolean
        readonly isGooglePending: boolean
    }
    readonly on: {
        readonly setEmail: (value: string) => void
        readonly setPassword: (value: string) => void
        readonly submit: () => void
        readonly google: () => void
        readonly resend: () => void
    }
}

/** Draws the sign-in card: Google, e-mail and password, links to sign-up and forgot password. */
export const LoginFormBase = (props: LoginFormBaseProps) => {
    const view = props.props
    const busy = view.isPasswordPending || view.isGooglePending
    return (
        <AuthPanel label={view.title} title={view.title} text={view.text}>
            {view.notice === undefined ? null : <Alert title={view.notice} tone="affirmative" />}
            {view.error === undefined ? null : (
                <Alert
                    title={view.failedTitle}
                    description={view.error}
                    tone="negative"
                    action={view.canResend ? { label: view.resendLabel, onAction: props.on.resend } : undefined}
                />
            )}
            <div className={LOGIN_ACTIONS_CLASS_NAME}>
                <Button
                    variant="secondary"
                    width="fill"
                    isPending={view.isGooglePending}
                    isDisabled={busy && !view.isGooglePending}
                    startContent={<Icon props={{ name: "google" }} />}
                    onPress={props.on.google}
                >
                    {view.googleLabel}
                </Button>
                <Divider label={view.orLabel} />
            </div>
            <AuthForm label={view.title} isPending={view.isPasswordPending} onSubmit={props.on.submit}>
                <EmailField
                    id="login-email"
                    label={view.emailLabel}
                    placeholder={view.emailPlaceholder}
                    value={view.email}
                    error={view.emailError}
                    isDisabled={busy}
                    onChange={props.on.setEmail}
                />
                <Input
                    id="login-password"
                    name="password"
                    kind="password"
                    label={view.passwordLabel}
                    revealLabel={view.showLabel}
                    hideLabel={view.hideLabel}
                    variant="secondary"
                    isRequired
                    isDisabled={busy}
                    value={view.password}
                    isError={view.passwordError !== undefined}
                    errorMessage={view.passwordError}
                    onValueChange={props.on.setPassword}
                />
                <div className={LOGIN_ROW_CLASS_NAME}>
                    <TextAction href={view.forgotHref}>{view.forgotLabel}</TextAction>
                </div>
                <Button variant="primary" width="fill" type="submit" isPending={view.isPasswordPending}>
                    {view.submitLabel}
                </Button>
            </AuthForm>
            <div className={LOGIN_CENTER_CLASS_NAME}>
                <Text size="sm" tone="muted">
                    {view.noAccountLabel}
                </Text>
                <TextAction href={view.signUpHref}>{view.signUpLabel}</TextAction>
            </div>
        </AuthPanel>
    )
}
