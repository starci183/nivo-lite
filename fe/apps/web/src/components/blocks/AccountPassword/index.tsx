"use client"

import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { PASSWORD_MIN } from "@/hooks/account"
import { writePassword } from "@/modules/db/account/write-password"
import { AccountPasswordBase } from "./component"

/** Props for the connected password card. */
interface AccountPasswordProps {
    /** True while the page loads: the card keeps its labels and shows skeletons. */
    readonly isLoading?: boolean
}

/** The connected password card: checks the current password, then sets the new one through a Server Action. */
export const AccountPassword = (props: AccountPasswordProps) => {
    const t = useTranslations("account")
    const [current, setCurrent] = useState("")
    const [next, setNext] = useState("")
    const [confirm, setConfirm] = useState("")
    const [error, setError] = useState<string>()
    const [done, setDone] = useState<string>()
    const [isPending, startTransition] = useTransition()

    const submit = () => {
        setError(undefined)
        setDone(undefined)
        if (current === "") return setError(t("errCurrent"))
        if (next.length < PASSWORD_MIN) return setError(t("errMin"))
        if (next !== confirm) return setError(t("errMatch"))
        if (next === current) return setError(t("errSameAsOld"))
        startTransition(async () => {
            const saved = await writePassword({ current, next, confirm })
            if (saved.kind !== "ok") {
                if (saved.code === "wrong-current") return setError(t("errWrongCurrent"))
                return setError(saved.code === "no-password" ? t("errNoPassword") : t("unknownError"))
            }
            setDone(t("passwordSaved"))
            setCurrent("")
            setNext("")
            setConfirm("")
        })
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
                current,
                next,
                confirm,
                isPending,
                isLoading: props.isLoading ?? false,
                error,
                done,
            }}
            on={{ setCurrent, setNext, setConfirm, submit }}
        />
    )
}
