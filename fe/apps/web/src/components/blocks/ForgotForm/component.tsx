import { Link, Stack } from "@starci/grammar/common"
import { AuthForm } from "@/components/frames/AuthForm"
import { AuthPanel } from "../../frames/AuthPanel"
import { CheckEmail } from "../../composites/CheckEmail"
import type { CheckEmailProps } from "../../composites/CheckEmail"
import { EmailField } from "../../composites/EmailField"
/** The two drawn shapes of the forgot-password card: the form, or the message once the request went out. */
export type ForgotFormShape = "form" | "sent"

/** The words and shape of the forgot-password card, resolved by the connected block. */
export interface ForgotFormBaseProps {
    readonly shape: ForgotFormShape
    readonly props: {
        readonly title: string
        readonly text: string
        readonly submitError?: { readonly title: string; readonly text: string } | undefined
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
    if (props.shape === "sent") {
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
                error={view.submitError}
                submitLabel={view.submitLabel}
                footer={
                    <Stack gap="inline" align="center">
                        <Link variant="plain" href={view.loginHref}>{view.backLabel}</Link>
                    </Stack>
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
