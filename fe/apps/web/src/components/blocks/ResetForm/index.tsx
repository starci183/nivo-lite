"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { PASSWORD_MIN_LENGTH, authErrorKey, isLinkInvalid, passwordStrength, strengthKey } from "@/hooks/auth"
import { writePasswordUpdate } from "@/modules/db/auth/write-password-update"
import { navigation } from "@/modules/i18n"
import { AUTH_ROUTES, loginResetPath } from "@/modules/routes"
import { ResetFormBase } from "./component"

/** What the reset page tells the card: whether the recovery link is already unusable. */
type ResetFormProps = { readonly expired: boolean }

type Errors = { readonly password?: string; readonly confirm?: string }

/** Reset password: new password and confirmation, or a clear "link expired" state with a way to request another. */
export const ResetForm = (props: ResetFormProps) => {
    const t = useTranslations("auth")
    const router = navigation.useRouter()
    const [password, setPassword] = useState("")
    const [confirm, setConfirm] = useState("")
    const [errors, setErrors] = useState<Errors>({})
    const [failure, setFailure] = useState<{ readonly text: string; readonly expired: boolean }>()
    const [isPending, startTransition] = useTransition()

    const submit = () => {
        const found: { password?: string; confirm?: string } = {}
        if (password.length < PASSWORD_MIN_LENGTH) found.password = t("errPasswordShort")
        if (confirm !== password) found.confirm = t("errPasswordMismatch")
        setErrors(found)
        setFailure(undefined)
        if (Object.keys(found).length > 0) return
        startTransition(async () => {
            const outcome = await writePasswordUpdate({ password })
            if (outcome.kind === "ok") {
                router.push(loginResetPath())
                return
            }
            setFailure({ text: t(authErrorKey(outcome.code)), expired: isLinkInvalid(outcome.code) })
        })
    }

    return (
        <ResetFormBase
            state={props.expired || failure?.expired === true ? "expired" : "form"}
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
                passwordError: errors.password,
                confirmError: errors.confirm,
                isPending,
                expiredTitle: t("resetExpiredTitle"),
                expiredText: t("resetExpiredText"),
                newLinkLabel: t("resetNewLink"),
                newLinkHref: AUTH_ROUTES.forgotPassword,
                backLabel: t("backToSignIn"),
                backHref: AUTH_ROUTES.login,
            }}
            on={{ setPassword, setConfirm, submit }}
        />
    )
}
