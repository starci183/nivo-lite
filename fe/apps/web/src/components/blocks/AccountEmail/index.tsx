"use client"

import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { writeEmail } from "@/modules/db/account/write-email"
import { AccountEmailBase } from "./component"

/** Props for the connected email card. */
interface AccountEmailProps {
    /** The address now on the account. */
    readonly email: string
    /** True while the page loads: the card keeps its labels and shows skeletons. */
    readonly isLoading?: boolean
}

/** The connected email card: sends the confirmation link for a new address; the address changes only after the link is opened. */
export const AccountEmail = (props: AccountEmailProps) => {
    const t = useTranslations("account")
    const [isEditing, setEditing] = useState(false)
    const [value, setValue] = useState("")
    const [error, setError] = useState<string>()
    const [done, setDone] = useState<string>()
    const [isPending, startTransition] = useTransition()

    const submit = () => {
        setError(undefined)
        setDone(undefined)
        startTransition(async () => {
            const sent = await writeEmail(value)
            if (sent.kind !== "ok") return setError(sent.code === "email-same" ? t("errEmailSame") : t("errEmail"))
            setDone(t("emailSent"))
            setEditing(false)
            setValue("")
        })
    }

    return (
        <AccountEmailBase
            props={{
                title: t("emailTitle"),
                currentLabel: t("emailCurrent"),
                email: props.email,
                hint: t("emailHint"),
                changeLabel: t("changeEmail"),
                newEmailLabel: t("newEmail"),
                sendLabel: t("sendConfirm"),
                cancelLabel: t("cancel"),
                failTitle: t("failTitle"),
                value,
                isEditing,
                isPending,
                isLoading: props.isLoading ?? false,
                error,
                done,
            }}
            on={{ setValue, submit, startEdit: () => setEditing(true), cancel: () => setEditing(false) }}
        />
    )
}
