import type { useResendEmail } from "@/hooks/auth"
import type { authActionsOf } from "@/hooks/auth"
import type { useTranslations } from "next-intl"
import type { navigation } from "@/modules/i18n"
import type { useSignupForm } from "@/hooks/rhf"
import type { useTransition } from "react"
import { Input, Text, TextAction } from "@starci/grammar/common"
import { AuthForm } from "../../composites/AuthForm"
import { AuthPanel } from "../../composites/AuthPanel"
import { CheckEmail } from "../../composites/CheckEmail"
import type { CheckEmailProps } from "../../composites/CheckEmail"
import { EmailField } from "../../composites/EmailField"
import { PasswordPair } from "../../composites/PasswordPair"
import { SIGNUP_CENTER_CLASS_NAME } from "./classNames"

/** The words and state of the sign-up card, resolved by the connected block. */
export interface SignupFormBaseProps {
    readonly state: "form" | "sent"
    readonly props: {
        readonly title: string
        readonly text: string
        readonly failure?: { readonly title: string; readonly text: string }
        readonly nameLabel: string
        readonly emailLabel: string
        readonly emailPlaceholder: string
        readonly passwordLabel: string
        readonly confirmLabel: string
        readonly passwordHint: string
        readonly showLabel: string
        readonly hideLabel: string
        readonly submitLabel: string
        readonly haveAccountLabel: string
        readonly signInLabel: string
        readonly loginHref: string
        readonly name: string
        readonly email: string
        readonly password: string
        readonly confirm: string
        readonly nameError?: string
        readonly emailError?: string
        readonly passwordError?: string
        readonly confirmError?: string
        readonly isPending: boolean
        readonly sentTitle: string
        readonly check: CheckEmailProps
    }
    readonly on: {
        readonly setName: (value: string) => void
        readonly setEmail: (value: string) => void
        readonly setPassword: (value: string) => void
        readonly setConfirm: (value: string) => void
        readonly submit: () => void
    }
}

/** Draws the sign-up card, or the "check your email" screen once the account exists. */
export const SignupFormBase = (props: SignupFormBaseProps) => {
    const view = props.props
    if (props.state === "sent") {
        return (
            <AuthPanel label={view.sentTitle} title={view.sentTitle}>
                <CheckEmail {...view.check} />
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
                footer={
                    <div className={SIGNUP_CENTER_CLASS_NAME}>
                        <Text size="sm" tone="muted">
                            {view.haveAccountLabel}
                        </Text>
                        <TextAction href={view.loginHref}>{view.signInLabel}</TextAction>
                    </div>
                }
                onSubmit={props.on.submit}
            >
                <Input
                    id="signup-name"
                    name="name"
                    label={view.nameLabel}
                    variant="secondary"
                    isRequired
                    isDisabled={view.isPending}
                    value={view.name}
                    isError={view.nameError !== undefined}
                    errorMessage={view.nameError}
                    onValueChange={props.on.setName}
                />
                <EmailField
                    id="signup-email"
                    label={view.emailLabel}
                    placeholder={view.emailPlaceholder}
                    value={view.email}
                    error={view.emailError}
                    isDisabled={view.isPending}
                    onChange={props.on.setEmail}
                />
                <PasswordPair
                    idPrefix="signup"
                    passwordLabel={view.passwordLabel}
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

/** State values and commands consumed by the connected surface. */
export type SignupFormProps = {
    /** The destination after the account exists (an invite page); already sanitised. */
    readonly next?: string
    readonly invited: boolean
    readonly initialEmail?: string
}

/** State values and commands consumed by the connected surface. */
export type SignupFormControllerInput = {
    readonly props: SignupFormProps
    readonly auth: ReturnType<typeof authActionsOf>
    readonly t: ReturnType<typeof useTranslations<"auth">>
    readonly router: ReturnType<typeof navigation.useRouter>
    readonly form: ReturnType<typeof useSignupForm>
    readonly failure: string | undefined
    readonly setFailure: React.Dispatch<React.SetStateAction<string | undefined>>
    readonly sentTo: string | null
    readonly setSentTo: React.Dispatch<React.SetStateAction<string | null>>
    readonly isPending: ReturnType<typeof useTransition>[0]
    readonly startTransition: ReturnType<typeof useTransition>[1]
    readonly resending: ReturnType<typeof useResendEmail>
}
