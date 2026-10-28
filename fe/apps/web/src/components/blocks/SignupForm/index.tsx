"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import {
    authErrorKey,
    passwordStrength,
    strengthKey,
    useResendEmail,
    useRedirectWhenSignedIn,
    authActionsOf,
} from "@/hooks/auth"
import { useSignupForm } from "@/hooks/rhf"
import { navigation } from "@/modules/i18n"
import { loginPath } from "@/modules/routes"
import { SignupFormBase } from "./component"

/** What the sign-up page tells the card. */
type SignupFormProps = {
    /** The destination after the account exists (an invite page); already sanitised. */
    readonly next?: string | undefined
    readonly invited: boolean
    readonly initialEmail?: string | undefined
}

/** Values and commands the sign-up controller consumes. */
type SignupFormControllerInput = {
    readonly props: SignupFormProps
    readonly auth: ReturnType<typeof authActionsOf>
    readonly t: ReturnType<typeof useTranslations<"auth">>
    readonly router: ReturnType<typeof navigation.useRouter>
    readonly form: ReturnType<typeof useSignupForm>
    readonly submitError: string | undefined
    readonly setSubmitError: React.Dispatch<React.SetStateAction<string | undefined>>
    readonly sentTo: string | null
    readonly setSentTo: React.Dispatch<React.SetStateAction<string | null>>
    readonly isPending: ReturnType<typeof useTransition>[0]
    readonly startTransition: ReturnType<typeof useTransition>[1]
    readonly resending: ReturnType<typeof useResendEmail>
}

const createSignupFormController = (input: SignupFormControllerInput) => {
    const { props, auth, t, router, form, setSubmitError, setSentTo, startTransition, resending } = input

    const set = (key: "name" | "email" | "password" | "confirm") => (value: string) => {
        form.setValue(key, value, { shouldValidate: form.formState.isSubmitted })
    }

    const submit = form.handleSubmit((values) => {
        setSubmitError(undefined)
        startTransition(async () => {
            const outcome = await auth.signUp({ ...values, next: props.next })
            if (!outcome.success || outcome.data === undefined) {
                setSubmitError(t(authErrorKey(outcome.error ?? "")))
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
    return { ...input, set, submit, fields, errors, loginHref }
}

/** Sign-up: name, e-mail, password with a strength hint, then the "check your email" screen. */
export const SignupForm = (props: SignupFormProps) => {
    const auth = authActionsOf()
    useRedirectWhenSignedIn(props.next)
    const t = useTranslations("auth")
    const router = navigation.useRouter()
    const form = useSignupForm(props.initialEmail)
    const [submitError, setSubmitError] = useState<string>()
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
    const context = createSignupFormController({
        props,
        auth,
        t,
        router,
        form,
        submitError,
        setSubmitError,
        sentTo,
        setSentTo,
        isPending,
        startTransition,
        resending,
    })

    return <SignupFormBase {...createSignupFormView(context)} />
}

const createSignupFormView = (
    context: ReturnType<typeof createSignupFormController>,
): React.ComponentProps<typeof SignupFormBase> => {
    const { props } = context

    const { t, submitError, sentTo, setSentTo, resending, set, submit, fields, errors, loginHref, isPending } = context
    return {
        shape: sentTo === null ? "form" : "sent",
        props: {
            title: t("signUpTitle"),
            text: props.invited ? t("signUpInviteText") : t("signUpText"),
            submitError: submitError === undefined ? undefined : { title: t("signUpFailedTitle"), text: submitError },
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
        },
        on: {
            setName: set("name"),
            setEmail: set("email"),
            setPassword: set("password"),
            setConfirm: set("confirm"),
            submit: () => void submit(),
        },
    }
}
