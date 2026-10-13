"use client"

import { useTranslations } from "next-intl"
import { useCallback, useState } from "react"
import { mutate } from "swr"
import { QUERY_MY_ACCOUNT_SWR_KEY } from "@/hooks/swr"
import { signOutOthers } from "@/modules/auth"
import { toast } from "@/modules/toast"

/** Signs the account out of every other device (Supabase Auth) and toasts the outcome. The device list is revalidated on success. */
export const useSignOutOthers = () => {
    const t = useTranslations("account")
    const tToast = useTranslations("toast")
    const [isPending, setPending] = useState(false)
    const run = useCallback(async (): Promise<boolean> => {
        setPending(true)
        const outcome = await signOutOthers()
        setPending(false)
        if (outcome.kind !== "ok") {
            toast.danger(tToast("errorTitle"), { description: t("unknownError") })
            return false
        }
        toast.success(tToast("successTitle"), { description: t("othersDone") })
        await mutate(QUERY_MY_ACCOUNT_SWR_KEY)
        return true
    }, [t, tToast])
    return { run, isPending }
}
