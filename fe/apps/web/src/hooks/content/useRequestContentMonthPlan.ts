"use client"

import { useTranslations } from "next-intl"
import { useMutateRequestContentMonthPlanSwr } from "@/hooks/swr"
import { useContentAiJob } from "./useContentAiJob"

/** Requests a month plan and polls until the saved ideas or a terminal failure are available. */
export const useRequestContentMonthPlan = (isActive = true, scope?: string) => {
    const t = useTranslations("content")
    const { trigger } = useMutateRequestContentMonthPlanSwr()
    const job = useContentAiJob({
        isActive,
        ...(scope === undefined ? {} : { scope }),
        queue: trigger,
        successMessage: (status) => {
            const past = (status.skippedPast ?? 0) > 0 ? ` ${t("planDonePast", { n: status.skippedPast ?? 0 })}` : ""
            return `${t("planDone", { n: status.ideas ?? 0, s: status.seconds ?? 0 })}${past}`
        },
    })
    return { ...job, request: (month: string) => job.request({ month }) }
}
