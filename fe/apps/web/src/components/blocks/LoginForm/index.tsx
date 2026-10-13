"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { EMAIL_PATTERN, authErrorKey, inviteOfNext } from "@/hooks/auth"
import { writeResendConfirmation } from "@/modules/db/auth/write-resend-confirmation"
import { writeSignIn } from "@/modules/db/auth/write-sign-in"
import { writeSignInOAuth } from "@/modules/db/auth/write-sign-in-oauth"
import { navigation } from "@/modules/i18n"
import { AUTH_ROUTES, signupPath } from "@/modules/routes"
import { LoginFormBase } from "./component"

/** What the sign-in page tells the card. */
type LoginFormProps = {
    /** Where to go after signing in (an invite page, a deep link); already sanitised. */
    readonly next?: string
    /** Machine code from the /auth routes (`link_expired`, `missing_code`, ...). */
    readonly errorCode?: string
    /** `reset` or `confirmed`: a success note from a finished flow. */
    readonly notice?: string
}

type Feedback = { readonly error?: string; readonly info?: string; readonly canResend: boolean }
type FieldErrors = { readonly email?: string; readonly password?: string }

/** The sentences for a failure a finished /auth route left in the URL. */
type InitialErrors = { readonly expired: string; readonly missing: string; readonly generic: string }

const initialError = (code: string | undefined, texts: InitialErrors): string | undefined => {
    if (code === undefined) return undefined
    if (code === "link_expired") return texts.expired
    return code === "missing_code" ? texts.missing : texts.generic
}

const initialInfo = (notice: string | undefined, reset: string, confirmed: string): string | undefined => {
    if (notice === "reset") return reset
    return notice === "confirmed" ? confirmed : undefined
}

/** The sign-in card: password and Google through Server Actions, with the friendly failure copy. */
export const LoginForm = (props: LoginFormProps) => {
    const t = useTranslations("login")
    const a = useTranslations("auth")
    const router = navigation.useRouter()
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
    const [feedback, setFeedback] = useState<Feedback>(() => ({
        canResend: false,
        error: initialError(props.errorCode, {
            expired: t("errLinkExpired"),
            missing: t("errMissingCode"),
            generic: a("errGeneric"),
        }),
        info: initialInfo(props.notice, t("noticeReset"), t("noticeConfirmed")),
    }))
    const [isGooglePending, setGooglePending] = useState(false)
    const [isPasswordPending, startPassword] = useTransition()
    const [, startResend] = useTransition()
    const invite = inviteOfNext(props.next)

    const fail = (code: string) => {
        const key = authErrorKey(code)
        setFeedback({ error: a(key), canResend: key === "errEmailNotConfirmed" })
    }
    const submit = () => {
        setFeedback({ canResend: false })
        const found: { email?: string; password?: string } = {}
        if (!EMAIL_PATTERN.test(email.trim())) found.email = a("errEmail")
        if (password === "") found.password = a("errPasswordRequired")
        setFieldErrors(found)
        if (Object.keys(found).length > 0) return
        startPassword(async () => {
            const input = new FormData()
            input.set("email", email.trim())
            input.set("password", password)
            if (props.next !== undefined) input.set("next", props.next)
            const outcome = await writeSignIn(input)
            if (outcome.kind === "ok") {
                router.push(outcome.value.path)
                router.refresh()
                return
            }
            fail(outcome.code)
        })
    }
    const google = () => {
        setFeedback({ canResend: false })
        setGooglePending(true)
        void writeSignInOAuth(props.next).then((outcome) => {
            if (outcome.kind === "ok") {
                window.location.assign(outcome.value.url)
                return
            }
            setFeedback({ error: a("errGeneric"), canResend: false })
            setGooglePending(false)
        })
    }
    const resend = () => {
        if (!EMAIL_PATTERN.test(email.trim())) {
            setFieldErrors({ email: a("errEmail") })
            return
        }
        startResend(async () => {
            const outcome = await writeResendConfirmation({ email, next: props.next })
            if (outcome.kind === "ok") setFeedback({ info: t("confirmSent"), canResend: false })
            else fail(outcome.code)
        })
    }

    return (
        <LoginFormBase
            props={{
                title: t("signInTitle"),
                text: t("signInText"),
                failedTitle: t("failedTitle"),
                resendLabel: t("resendConfirm"),
                googleLabel: t("google"),
                orLabel: t("or"),
                emailLabel: a("emailLabel"),
                emailPlaceholder: a("emailPlaceholder"),
                passwordLabel: a("passwordLabel"),
                showLabel: a("showPassword"),
                hideLabel: a("hidePassword"),
                forgotLabel: t("forgot"),
                forgotHref: AUTH_ROUTES.forgotPassword,
                submitLabel: t("submit"),
                noAccountLabel: t("noAccount"),
                signUpLabel: t("signUpLink"),
                signUpHref: signupPath(invite),
                email,
                password,
                emailError: fieldErrors.email,
                passwordError: fieldErrors.password,
                error: feedback.error,
                notice: feedback.info,
                canResend: feedback.canResend,
                isPasswordPending,
                isGooglePending,
            }}
            on={{ setEmail, setPassword, submit, google, resend }}
        />
    )
}
