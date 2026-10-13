"use client"

import { useTranslations } from "next-intl"
import { useCallback } from "react"
import { toast } from "@/modules/toast"

/** Puts an invitation link on the clipboard. Answers whether it worked; a refusal (a blocked clipboard) is toasted, and the link stays on screen to copy by hand. */
export const useCopyInviteLink = () => {
    const t = useTranslations("team")
    const tToast = useTranslations("toast")
    return useCallback(
        async (link: string): Promise<boolean> => {
            try {
                await navigator.clipboard.writeText(link)
                return true
            } catch {
                toast.danger(tToast("errorTitle"), { description: t("errGeneric") })
                return false
            }
        },
        [t, tToast],
    )
}
