"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useAccountSignIn, useChangePassword } from "@/hooks/account"
import { usePasswordForm } from "@/hooks/rhf"
import { useSlotLabels } from "@/hooks/slot"
import { AccountSignInBase } from "./component"

/**
 * The connected sign-in card: the address and the linked methods from the account read, and the change-password dialog that checks
 * the current password, then sets the new one through Auth (outcome toasted, the dialog closes on success).
 */
export const AccountSignIn = () => {
    const t = useTranslations("account")
    const slotLabels = useSlotLabels()
    const { slot, reload } = useAccountSignIn()
    const { change, isPending, error } = useChangePassword()
    const form = usePasswordForm()
    const [isOpen, setOpen] = useState(false)

    const close = () => {
        setOpen(false)
        form.reset()
    }
    const submit = form.handleSubmit(async (values) => {
        if (await change({ current: values.current, next: values.next })) close()
    })
    const errors = form.formState.errors
    const set = (field: "current" | "next" | "confirm") => (value: string) => {
        form.setValue(field, value, { shouldValidate: form.formState.isSubmitted })
    }

    return (
        <AccountSignInBase
            props={{
                title: t("signInTitle"),
                emailLabel: t("emailCurrent"),
                emailHint: t("emailHint"),
                linkedLabel: t("methodLinked"),
                notLinkedLabel: t("methodNotLinked"),
                methodHint: t("passwordMin"),
                changeLabel: t("changePassword"),
                slot,
                placeholder: {
                    email: "email@example.com",
                    methods: [
                        { id: "google", label: t("methodGoogle"), isLinked: false },
                        { id: "email", label: t("methodEmail"), isLinked: false },
                    ],
                },
                labels: slotLabels(t("loadFailed")),
                password: {
                    isOpen,
                    title: t("changePassword"),
                    hint: t("passwordHint"),
                    closeLabel: t("close"),
                    cancelLabel: t("cancel"),
                    currentLabel: t("currentPassword"),
                    newLabel: t("newPassword"),
                    newHint: t("passwordMin"),
                    confirmLabel: t("confirmPassword"),
                    failTitle: t("failTitle"),
                    current: form.watch("current"),
                    next: form.watch("next"),
                    confirm: form.watch("confirm"),
                    isPending,
                    error: errors.current?.message ?? errors.next?.message ?? errors.confirm?.message ?? error,
                },
            }}
            on={{
                retry: reload,
                openPassword: () => setOpen(true),
                closePassword: close,
                setCurrent: set("current"),
                setNext: set("next"),
                setConfirm: set("confirm"),
                submitPassword: () => void submit(),
            }}
        />
    )
}
