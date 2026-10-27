"use client"

import { useTranslations } from "next-intl"
import { useChangePassword } from "@/hooks/account"
import { usePasswordForm } from "@/hooks/rhf"
import { AccountPasswordBase } from "./component"

/** The connected password card: checks the current password, then sets the new one through Auth (outcome toasted). */
export const AccountPassword = () => {
    const t = useTranslations("account")
    const { change, isPending, error } = useChangePassword()
    const form = usePasswordForm()

    const submit = form.handleSubmit(async (values) => {
        if (await change({ current: values.current, next: values.next })) form.reset()
    })
    const errors = form.formState.errors
    const set = (field: "current" | "next" | "confirm") => (value: string) => {
        form.setValue(field, value, { shouldValidate: form.formState.isSubmitted })
    }

    return (
        <AccountPasswordBase
            props={{
                title: t("passwordTitle"),
                hint: t("passwordHint"),
                currentLabel: t("currentPassword"),
                newLabel: t("newPassword"),
                confirmLabel: t("confirmPassword"),
                submitLabel: t("changePassword"),
                failTitle: t("failTitle"),
                current: form.watch("current"),
                next: form.watch("next"),
                confirm: form.watch("confirm"),
                isPending,
                error: errors.current?.message ?? errors.next?.message ?? errors.confirm?.message ?? error,
            }}
            on={{
                setCurrent: set("current"),
                setNext: set("next"),
                setConfirm: set("confirm"),
                submit: () => void submit(),
            }}
        />
    )
}
