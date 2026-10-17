"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useChangeEmail } from "@/hooks/account"
import { useEmailForm } from "@/hooks/rhf"
import { useQueryMyAccountSwr } from "@/hooks/swr"
import { AccountEmailBase } from "./component"

/**
 * The connected email card: sends the confirmation link for a new address; the address changes only after the link is
 * opened.
 */
export const AccountEmail = () => {
    const t = useTranslations("account")
    const { data, isLoading } = useQueryMyAccountSwr()
    const { send, isPending, error } = useChangeEmail()
    const form = useEmailForm()
    const [isEditing, setEditing] = useState(false)

    const submit = form.handleSubmit(async (values) => {
        if (!(await send(values.email))) return
        setEditing(false)
        form.reset()
    })

    return (
        <AccountEmailBase
            props={{
                title: t("emailTitle"),
                currentLabel: t("emailCurrent"),
                email: data?.email ?? "",
                hint: t("emailHint"),
                changeLabel: t("changeEmail"),
                newEmailLabel: t("newEmail"),
                sendLabel: t("sendConfirm"),
                cancelLabel: t("cancel"),
                failTitle: t("failTitle"),
                value: form.watch("email"),
                isEditing,
                isPending,
                isLoading,
                error: form.formState.errors.email?.message ?? error,
            }}
            on={{
                setValue: (value) => form.setValue("email", value, { shouldValidate: form.formState.isSubmitted }),
                submit: () => void submit(),
                startEdit: () => setEditing(true),
                cancel: () => {
                    setEditing(false)
                    form.reset()
                },
            }}
        />
    )
}
