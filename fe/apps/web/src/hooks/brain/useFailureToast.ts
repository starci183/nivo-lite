"use client"

import { useTranslations } from "next-intl"
import { toast } from "@/modules/toast"

/** Gives a Brain screen the one failure toast it shows when a write it started is rejected, so screens never reach the toast module themselves. */
export const useFailureToast = (): (() => void) => {
    const feedback = useTranslations("toast")
    return () => {
        toast.danger(feedback("errorTitle"), { description: feedback("defaultError") })
    }
}
