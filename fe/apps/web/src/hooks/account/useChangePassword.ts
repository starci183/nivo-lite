"use client"

import { useTranslations } from "next-intl"
import { useCallback, useState } from "react"
import { changePassword } from "@/modules/auth"
import type { PasswordChange } from "@/modules/auth"
import { toast } from "@/modules/toast"
import { accountErrorKey } from "./account.shared"

/** Checks the current password and sets the new one through Auth, then toasts the outcome. */
export const useChangePassword = () => {
    const t = useTranslations("account")
    const tToast = useTranslations("toast")
    const [isPending, setPending] = useState(false)
    const [error, setError] = useState<string>()
    const change = useCallback(
        async (input: PasswordChange): Promise<boolean> => {
            setPending(true)
            setError(undefined)
            const outcome = await changePassword(input)
            setPending(false)
            if (!outcome.success) {
                setError(t(accountErrorKey(outcome.error ?? "")))
                return false
            }
            toast.success(tToast("successTitle"), { description: t("passwordSaved") })
            return true
        },
        [t, tToast],
    )
    return { change, isPending, error }
}
