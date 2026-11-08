"use client"

import { useTranslations } from "next-intl"
import { useCallback, useState } from "react"
import { useMutateChangePasswordSwr } from "@/hooks/swr"
import { graphQLErrorCode } from "@/modules/failure"
import { toast } from "@/modules/toast"
import { accountErrorKey } from "./account.shared"

/** The current password and the one it becomes. */
export interface PasswordChange {
    readonly current: string
    readonly next: string
}

/** The view `useChangePassword` returns. */
export interface ChangePasswordView {
    change: (input: PasswordChange) => Promise<boolean>
    isPending: boolean
    error: string | undefined
}

/** Checks the current password and sets the new one through the `changePassword` mutation, then toasts the outcome. */
export const useChangePassword = (): ChangePasswordView => {
    const t = useTranslations("account")
    const tToast = useTranslations("toast")
    const { trigger, isMutating } = useMutateChangePasswordSwr()
    const [error, setError] = useState<string>()
    const change = useCallback(
        async (input: PasswordChange): Promise<boolean> => {
            setError(undefined)
            try {
                await trigger({ currentPassword: input.current, newPassword: input.next })
            } catch (error_) {
                setError(t(accountErrorKey(graphQLErrorCode(error_) ?? "")))
                return false
            }
            toast.success(tToast("successTitle"), { description: t("passwordSaved") })
            return true
        },
        [t, tToast, trigger],
    )
    return { change, isPending: isMutating, error }
}
