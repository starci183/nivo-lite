"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { authErrorKey, inviteOfNext, authActionsOf } from "@/hooks/auth"

import { useLoginForm } from "@/hooks/rhf"
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

/** The sign-in card: password and Google through the browser Auth client, with the friendly failure copy. */
export const LoginForm = (props: LoginFormProps) => {
    const auth = authActionsOf()
    const t = useTranslations("login")
    const a = useTranslations("auth")
    const router = navigation.useRouter()
    const form = useLoginForm()
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
    const submit = form.handleSubmit((values) => {
        setFeedback({ canResend: false })
        startPassword(async () => {
            const outcome = await auth.signInWithPassword({
                email: values.email,
                password: values.password,
                next: props.next,
            })
            if (outcome.success && outcome.data !== undefined) {
                router.push(outcome.data.path)
                router.refresh()
                return
            }
            fail(outcome.error ?? "")
        })
    })
    const google = () => {
        setFeedback({ canResend: false })
        setGooglePending(true)
        void auth.startOAuth(props.next).then((outcome) => {
            if (outcome.success && outcome.data !== undefined) {
                window.location.assign(outcome.data.url)
                return
            }
            setFeedback({ error: a("errGeneric"), canResend: false })
            setGooglePending(false)
        })
    }
    const resend = async () => {
        if (!(await form.trigger("email"))) return
        const email = form.getValues("email")
        startResend(async () => {
            const outcome = await auth.resendConfirmation({ email, next: props.next })
            if (outcome.success) setFeedback({ info: t("confirmSent"), canResend: false })
            else fail(outcome.error ?? "")
        })
    }

    return (
        <LoginFormBase
            props={buildLoginFormView({ t, a, invite, form, feedback, isPasswordPending, isGooglePending })}
            on={{
                setEmail: (value) => form.setValue("email", value, { shouldValidate: form.formState.isSubmitted }),
                setPassword: (value) =>
                    form.setValue("password", value, { shouldValidate: form.formState.isSubmitted }),
                submit: () => void submit(),
                google,
                resend: () => void resend(),
            }}
        />
    )
}

/** Inputs needed to build the LoginFormContent section. */
interface BuildLoginFormViewContext {
    readonly t: ReturnType<typeof useTranslations<"login">>
    readonly a: ReturnType<typeof useTranslations<"auth">>
    readonly invite: string | undefined
    readonly form: ReturnType<typeof useLoginForm>
    readonly feedback: Feedback
    readonly isPasswordPending: boolean
    readonly isGooglePending: boolean
}
/** Builds the LoginFormContent section from the current view. */
const buildLoginFormView = ({
    t,
    a,
    invite,
    form,
    feedback,
    isPasswordPending,
    isGooglePending,
}: BuildLoginFormViewContext) =>
    ({
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
        forgotHref: AUTH_ROUTES.forgot,
        submitLabel: t("submit"),
        noAccountLabel: t("noAccount"),
        signUpLabel: t("signUpLink"),
        signUpHref: signupPath(invite),
        email: form.watch("email"),
        password: form.watch("password"),
        emailError: form.formState.errors.email?.message,
        passwordError: form.formState.errors.password?.message,
        error: feedback.error,
        notice: feedback.info,
        canResend: feedback.canResend,
        isPasswordPending,
        isGooglePending,
    }) as const
