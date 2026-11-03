"use client"

import { useTranslations } from "next-intl"
import { useMutateRequestContentMonthPlanSwr } from "@/hooks/swr"
import { useContentAiJob } from "./useContentAiJob"

/** The view `useRequestContentMonthPlan` returns. */
export interface RequestContentMonthPlanView {
    request: (month: string) => Promise<
        | {
              id: string
              itemId: string | null
              status: string
          }
        | undefined
    >
    status:
        | {
              id: string
              status: string
              progress: number
              itemId: string | null
              planId: string | null
              resultId: string | null
              ideas: number | null
              seconds: number | null
              skippedPast: number | null
              errorCode: string | null
              warnings: Array<{
                  channel: string
                  warning: {
                      kind: string
                      phrase: string | null
                      figure: string | null
                      length: number | null
                      max: number | null
                  }
              }>
          }
        | undefined
    isPending: boolean
}

/** Requests a month plan and polls until the saved ideas or a terminal failure are available. */
export const useRequestContentMonthPlan = (isActive = true, scope?: string): RequestContentMonthPlanView => {
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
