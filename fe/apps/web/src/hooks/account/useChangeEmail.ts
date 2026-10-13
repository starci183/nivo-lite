"use client"

import { useTranslations } from "next-intl"
import { useCallback, useState } from "react"
import { changeEmail } from "@/modules/auth"
import { toast } from "@/modules/toast"
import { accountErrorKey } from "./account.shared"

/** Asks Auth to send the confirmation link for a new sign-in address (it changes only after the link is opened) and toasts the outcome. */
export const useChangeEmail = () => {
    const t = useTranslations("account")
    const tToast = useTranslations("toast")
    const [isPending, setPending] = useState(false)
    const [error, setError] = useState<string>()
    const send = useCallback(
        async (email: string): Promise<boolean> => {
            setPending(true)
            setError(undefined)
            const outcome = await changeEmail(email)
            setPending(false)
            if (!outcome.success) {
                setError(t(accountErrorKey(outcome.error ?? "")))
                return false
            }
            toast.success(tToast("successTitle"), { description: t("emailSent") })
            return true
        },
        [t, tToast],
    )
    return { send, isPending, error }
}
