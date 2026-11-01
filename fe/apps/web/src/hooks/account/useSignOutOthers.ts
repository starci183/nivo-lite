"use client"

import { useTranslations } from "next-intl"
import { useCallback } from "react"
import { mutate } from "@/modules/viewer-cache"
import { QUERY_MY_ACCOUNT_SWR_KEY, useMutateLogoutOtherSessionsSwr } from "@/hooks/swr"
import { toast } from "@/modules/toast"
import { matchesSwrKey } from "@/modules/utils"

/** Signs the account out of every other device (`logoutOtherSessions`) and toasts the outcome. The device list is revalidated on success. */
export const useSignOutOthers = () => {
    const t = useTranslations("account")
    const tToast = useTranslations("toast")
    const { trigger, isMutating } = useMutateLogoutOtherSessionsSwr()
    const run = useCallback(async (): Promise<boolean> => {
        try {
            await trigger()
        } catch {
            toast.danger(tToast("errorTitle"), { description: t("unknownError") })
            return false
        }
        toast.success(tToast("successTitle"), { description: t("othersDone") })
        await mutate(matchesSwrKey(QUERY_MY_ACCOUNT_SWR_KEY))
        return true
    }, [t, tToast, trigger])
    return { run, isPending: isMutating }
}
