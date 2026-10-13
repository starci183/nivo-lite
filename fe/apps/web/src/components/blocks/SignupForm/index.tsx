"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import {
    authErrorKey,
    passwordStrength,
    strengthKey,
    useResendEmail,
    useAuthActions,
    useRedirectWhenSignedIn,
} from "@/hooks/auth"
import { useSignupForm } from "@/hooks/rhf"
import { navigation } from "@/modules/i18n"
import { loginPath } from "@/modules/routes"
import { SignupFormBase } from "./component"

/** What the sign-up page tells the card. */
type SignupFormProps = {
    /** The destination after the account exists (an invite page); already sanitised. */
    readonly next?: string
    readonly invited: boolean
    readonly initialEmail?: string
}

/** Sign-up: name, e-mail, password with a strength hint, then the "check your email" screen. */
export const SignupForm = (props: SignupFormProps) => {
    const auth = useAuthActions()
    useRedirectWhenSignedIn(props.next)
    const t = useTranslations("auth")
    const router = navigation.useRouter()
    const form = useSignupForm(props.initialEmail)
    const [failure, setFailure] = useState<string>()
    const [sentTo, setSentTo] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()
    const resending = useResendEmail(() => auth.resendConfirmation({ email: sentTo, next: props.next }), {
        sentTitle: t("resentTitle"),
        sentText: t("resentText"),
        failedTitle: t("errGeneric"),
        describe: (key) => t(key),
        resendLabel: t("resend"),
        waitLabel: (seconds) => t("resendWait", { seconds }),
    })
    const set = (key: "name" | "email" | "password" | "confirm") => (value: string) => {
        form.setValue(key, value, { shouldValidate: form.formState.isSubmitted })
    }

    const submit = form.handleSubmit((values) => {
        setFailure(undefined)
        startTransition(async () => {
            const outcome = await auth.signUp({ ...values, next: props.next })
            if (!outcome.success || outcome.data === undefined) {
                setFailure(t(authErrorKey(outcome.error ?? "")))
                return
            }
            if (outcome.data.sessionCreated) {
                router.push(outcome.data.path)
                router.refresh()
                return
            }
            setSentTo(values.email.trim().toLowerCase())
            resending.arm()
        })
    })

    const fields = form.watch()
    const errors = form.formState.errors

    const loginHref = loginPath(props.next)
    return (
        <SignupFormBase
            state={sentTo === null ? "form" : "sent"}
            props={{
                title: t("signUpTitle"),
                text: props.invited ? t("signUpInviteText") : t("signUpText"),
                failure: failure === undefined ? undefined : { title: t("signUpFailedTitle"), text: failure },
                nameLabel: t("nameLabel"),
                emailLabel: t("emailLabel"),
                emailPlaceholder: t("emailPlaceholder"),
                passwordLabel: t("passwordLabel"),
                confirmLabel: t("confirmLabel"),
                passwordHint:
                    fields.password === "" ? t("passwordHint") : t(strengthKey(passwordStrength(fields.password))),
                showLabel: t("showPassword"),
                hideLabel: t("hidePassword"),
                submitLabel: t("signUpSubmit"),
                haveAccountLabel: t("haveAccount"),
                signInLabel: t("signInLink"),
                loginHref,
                name: fields.name,
                email: fields.email,
                password: fields.password,
                confirm: fields.confirm,
                nameError: errors.name?.message,
                emailError: errors.email?.message,
                passwordError: errors.password?.message,
                confirmError: errors.confirm?.message,
                isPending,
                sentTitle: t("checkTitle"),
                check: {
                    ...resending.view,
                    text: t("checkText", { email: sentTo ?? "" }),
                    hint: t("checkHint"),
                    wrongEmailLabel: t("wrongEmail"),
                    backLabel: t("backToSignIn"),
                    backHref: loginHref,
                    onChangeEmail: () => {
                        setSentTo(null)
                    },
                },
            }}
            on={{
                setName: set("name"),
                setEmail: set("email"),
                setPassword: set("password"),
                setConfirm: set("confirm"),
                submit: () => void submit(),
            }}
        />
    )
}
