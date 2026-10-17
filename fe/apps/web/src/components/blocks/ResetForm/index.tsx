"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { authErrorKey, isLinkInvalid, passwordStrength, strengthKey, useQueryAuthUserSwr } from "@/hooks/auth"
import { authActionsOf } from "@/hooks/auth"
import { useResetForm } from "@/hooks/rhf"
import { navigation } from "@/modules/i18n"
import { AUTH_ROUTES, loginResetPath } from "@/modules/routes"
import { ResetFormBase } from "./component"

/** What the reset page tells the card: whether the recovery link is already unusable. */
type ResetFormProps = { readonly expired: boolean }

/** Reset password: new password and confirmation, or a clear "link expired" state with a way to request another. */
export const ResetForm = (props: ResetFormProps) => {
    const auth = authActionsOf()
    const t = useTranslations("auth")
    const router = navigation.useRouter()
    const form = useResetForm()
    const [failure, setFailure] = useState<{ readonly text: string; readonly expired: boolean }>()
    const [isPending, startTransition] = useTransition()
    const [isDone, setDone] = useState(false)
    const { data: user } = useQueryAuthUserSwr()

    const password = form.watch("password")
    const confirm = form.watch("confirm")
    const errors = form.formState.errors
    const submit = form.handleSubmit((values) => {
        setFailure(undefined)
        startTransition(async () => {
            const outcome = await auth.updatePassword({ password: values.password })
            if (outcome.success) {
                setDone(true)
                router.push(loginResetPath())
                return
            }
            setFailure({ text: t(authErrorKey(outcome.error ?? "")), expired: isLinkInvalid(outcome.error ?? "") })
        })
    })

    return (
        <ResetFormBase
            state={props.expired || failure?.expired === true || (user === null && !isDone) ? "expired" : "form"}
            props={{
                title: t("resetTitle"),
                text: t("resetText"),
                failure: failure === undefined ? undefined : { title: t("resetFailedTitle"), text: failure.text },
                newPasswordLabel: t("newPasswordLabel"),
                confirmLabel: t("confirmLabel"),
                passwordHint: password === "" ? t("passwordHint") : t(strengthKey(passwordStrength(password))),
                showLabel: t("showPassword"),
                hideLabel: t("hidePassword"),
                submitLabel: t("resetSubmit"),
                password,
                confirm,
                passwordError: errors.password?.message,
                confirmError: errors.confirm?.message,
                isPending,
                expiredTitle: t("resetExpiredTitle"),
                expiredText: t("resetExpiredText"),
                newLinkLabel: t("resetNewLink"),
                newLinkHref: AUTH_ROUTES.forgot,
                backLabel: t("backToSignIn"),
                backHref: AUTH_ROUTES.login,
            }}
            on={{
                setPassword: (value) =>
                    form.setValue("password", value, { shouldValidate: form.formState.isSubmitted }),
                setConfirm: (value) => form.setValue("confirm", value, { shouldValidate: form.formState.isSubmitted }),
                submit: () => void submit(),
            }}
        />
    )
}
