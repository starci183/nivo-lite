"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { authErrorKey, useResendEmail, useAuthActions } from "@/hooks/auth"
import { useForgotForm } from "@/hooks/rhf"
import { AUTH_ROUTES } from "@/modules/routes"
import { ForgotFormBase } from "./component"

/** What the forgot-password page tells the card. */
type ForgotFormProps = { readonly initialEmail?: string }

/** Forgot password: e-mail in, a generic "if the account exists" message out (no account enumeration). */
export const ForgotForm = (props: ForgotFormProps) => {
    const auth = useAuthActions()
    const t = useTranslations("auth")
    const form = useForgotForm(props.initialEmail)
    const [failure, setFailure] = useState<string>()
    const [sentTo, setSentTo] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()
    const resending = useResendEmail(() => auth.requestPasswordReset({ email: sentTo }), {
        sentTitle: t("resentTitle"),
        sentText: t("resentText"),
        failedTitle: t("errGeneric"),
        describe: (key) => t(key),
        resendLabel: t("resend"),
        waitLabel: (seconds) => t("resendWait", { seconds }),
    })

    const submit = form.handleSubmit((values) => {
        setFailure(undefined)
        startTransition(async () => {
            const outcome = await auth.requestPasswordReset({ email: values.email })
            if (outcome.success) {
                setSentTo(values.email.trim().toLowerCase())
                resending.arm()
                return
            }
            setFailure(t(authErrorKey(outcome.error ?? "")))
        })
    })

    return (
        <ForgotFormBase
            state={sentTo === null ? "form" : "sent"}
            props={{
                title: t("forgotTitle"),
                text: t("forgotText"),
                failure: failure === undefined ? undefined : { title: t("errGeneric"), text: failure },
                emailLabel: t("emailLabel"),
                emailPlaceholder: t("emailPlaceholder"),
                submitLabel: t("forgotSubmit"),
                backLabel: t("backToSignIn"),
                loginHref: AUTH_ROUTES.login,
                email: form.watch("email"),
                emailError: form.formState.errors.email?.message,
                isPending,
                sentTitle: t("forgotSentTitle"),
                check: {
                    ...resending.view,
                    text: t("forgotSentText", { email: sentTo ?? "" }),
                    wrongEmailLabel: t("wrongEmail"),
                    backLabel: t("backToSignIn"),
                    backHref: AUTH_ROUTES.login,
                    onChangeEmail: () => {
                        setSentTo(null)
                    },
                },
            }}
            on={{
                setEmail: (value) => form.setValue("email", value, { shouldValidate: form.formState.isSubmitted }),
                submit: () => void submit(),
            }}
        />
    )
}
