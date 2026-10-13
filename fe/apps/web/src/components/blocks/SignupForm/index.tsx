"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import {
    EMAIL_PATTERN,
    NAME_MIN_LENGTH,
    PASSWORD_MIN_LENGTH,
    authErrorKey,
    passwordStrength,
    strengthKey,
    useResendEmail,
    useAuthActions,
} from "@/hooks/auth"
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

type Fields = { readonly name: string; readonly email: string; readonly password: string; readonly confirm: string }
type Errors = Partial<Record<keyof Fields, string>>

/** Sign-up: name, e-mail, password with a strength hint, then the "check your email" screen. */
export const SignupForm = (props: SignupFormProps) => {
    const auth = useAuthActions()
    const t = useTranslations("auth")
    const router = navigation.useRouter()
    const [fields, setFields] = useState<Fields>({
        name: "",
        email: props.initialEmail ?? "",
        password: "",
        confirm: "",
    })
    const [errors, setErrors] = useState<Errors>({})
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
    const set = (key: keyof Fields) => (value: string) => {
        setFields((current) => ({ ...current, [key]: value }))
    }

    const submit = () => {
        const found: { -readonly [key in keyof Fields]?: string } = {}
        if (fields.name.trim().length < NAME_MIN_LENGTH) found.name = t("errName")
        if (!EMAIL_PATTERN.test(fields.email.trim())) found.email = t("errEmail")
        if (fields.password.length < PASSWORD_MIN_LENGTH) found.password = t("errPasswordShort")
        if (fields.confirm !== fields.password) found.confirm = t("errPasswordMismatch")
        setErrors(found)
        setFailure(undefined)
        if (Object.keys(found).length > 0) return
        startTransition(async () => {
            const outcome = await auth.signUp({ ...fields, next: props.next })
            if (outcome.kind !== "ok") {
                setFailure(t(authErrorKey(outcome.code)))
                return
            }
            if (outcome.value.sessionCreated) {
                router.push(outcome.value.path)
                router.refresh()
                return
            }
            setSentTo(fields.email.trim().toLowerCase())
            resending.arm()
        })
    }

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
                nameError: errors.name,
                emailError: errors.email,
                passwordError: errors.password,
                confirmError: errors.confirm,
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
                submit,
            }}
        />
    )
}
