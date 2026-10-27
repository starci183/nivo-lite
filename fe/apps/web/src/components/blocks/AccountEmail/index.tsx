"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useChangeEmail } from "@/hooks/account"
import { useEmailForm } from "@/hooks/rhf"
import { mapSlot, slotOfSwr, useSlotLabels } from "@/hooks/slot"
import { useQueryMyAccountSwr } from "@/hooks/swr"
import { AccountEmailBase } from "./component"

/**
 * The connected email card: sends the confirmation link for a new address; the address changes only after the link is
 * opened.
 */
export const AccountEmail = () => {
    const t = useTranslations("account")
    const slotLabels = useSlotLabels()
    const read = useQueryMyAccountSwr()
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
                slot: mapSlot(slotOfSwr(read), (account) => account.email),
                labels: slotLabels(t("loadFailed")),
                hint: t("emailHint"),
                changeLabel: t("changeEmail"),
                newEmailLabel: t("newEmail"),
                sendLabel: t("sendConfirm"),
                cancelLabel: t("cancel"),
                failTitle: t("failTitle"),
                value: form.watch("email"),
                isEditing,
                isPending,
                error: form.formState.errors.email?.message ?? error,
            }}
            on={{
                retry: () => void read.mutate(),
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
