"use client"

import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { onboardingStepsOf } from "@/hooks/overviewPromo"
import { useWorkspaceId } from "@/hooks/workspaces"
import { useOverviewData } from "./useOverviewData"

import type { OnboardingStep } from "@/modules/promo"

/** The onboarding steps, done or not from the real facts of the workspace; undefined until the dashboard is read. */
export const useOverviewSteps = (): OnboardingStep[] | undefined => {
    const t = useTranslations("promo")
    const { dashboard } = useOverviewData()
    const workspaceId = useWorkspaceId()
    return useMemo(
        () => (dashboard === undefined ? undefined : onboardingStepsOf(dashboard.promo, (key) => t(key), workspaceId)),
        [dashboard, t, workspaceId],
    )
}
