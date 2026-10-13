"use client"

import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { onboardingStepsOf } from "@/hooks/overviewPromo"
import { useOverviewData } from "./useOverviewData"

/** The onboarding steps, done or not from the real facts of the workspace; undefined until the dashboard is read. */
export const useOverviewSteps = () => {
    const t = useTranslations("promo")
    const { dashboard } = useOverviewData()
    return useMemo(() => (dashboard === undefined ? undefined : onboardingStepsOf(dashboard.promo, (key) => t(key))), [dashboard, t])
}
