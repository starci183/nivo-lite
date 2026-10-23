import { TextAction } from "@starci/grammar/common"
import { AuthForm } from "../../composites/AuthForm"
import { AuthPanel } from "../../composites/AuthPanel"
import { CheckEmail } from "../../composites/CheckEmail"
import type { CheckEmailProps } from "../../composites/CheckEmail"
import { EmailField } from "../../composites/EmailField"
import { FORGOT_CENTER_CLASS_NAME } from "./classNames"

/** The words and state of the forgot-password card, resolved by the connected block. */
export interface ForgotFormBaseProps {
    readonly state: "form" | "sent"
    readonly props: {
        readonly title: string
        readonly text: string
        readonly failure?: { readonly title: string; readonly text: string } | undefined
        readonly emailLabel: string
        readonly emailPlaceholder: string
        readonly submitLabel: string
        readonly backLabel: string
        readonly loginHref: string
        readonly email: string
        readonly emailError?: string | undefined
        readonly isPending: boolean
        readonly sentTitle: string
        readonly check: CheckEmailProps
    }
    readonly on: {
        readonly setEmail: (value: string) => void
        readonly submit: () => void
    }
}

/** Draws the forgot-password card, or the generic "if the account exists" message once the request went out. */
export const ForgotFormBase = (props: ForgotFormBaseProps) => {
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
                onSubmit={props.on.submit}
                label={view.title}
                isPending={view.isPending}
                failure={view.failure}
                submitLabel={view.submitLabel}
                footer={
                    <div className={FORGOT_CENTER_CLASS_NAME}>
                        <TextAction href={view.loginHref}>{view.backLabel}</TextAction>
                    </div>
                }
            >
                <EmailField
                    id="forgot-email"
                    label={view.emailLabel}
                    placeholder={view.emailPlaceholder}
                    value={view.email}
                    error={view.emailError}
                    isDisabled={view.isPending}
                    onChange={props.on.setEmail}
                />
            </AuthForm>
        </AuthPanel>
    )
}
