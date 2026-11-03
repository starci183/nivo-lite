"use client"
import { whenSelected } from "@/modules/utils"
import type { HiringSelectedViewInput } from "./hiringWorkbench.shared"

import { useHiringJobsView } from "./useHiringJobsView"
import { useHiringPipelineView } from "./useHiringPipelineView"
import { useHiringInterviewsView } from "./useHiringInterviewsView"
import { useHiringOffersView } from "./useHiringOffersView"
import { useHiringOnboardingView } from "./useHiringOnboardingView"

/** Keeps each controller tied to the exact tab that formerly mounted its block. */
export const useHiringBoardViews = (input: HiringSelectedViewInput) => {
    const jobs = useHiringJobsView(whenSelected(input, "jobs"))
    const pipeline = useHiringPipelineView(whenSelected(input, "candidates"))
    const interviews = useHiringInterviewsView(whenSelected(input, "interviews"))
    const offers = useHiringOffersView(whenSelected(input, "offers"))
    const onboarding = useHiringOnboardingView(whenSelected(input, "onboarding"))
    return {
        props: {
            jobs: jobs.props,
            pipeline: pipeline.props,
            interviews: interviews.props,
            offers: offers.props,
            onboarding: onboarding.props,
        },
        on: {
            jobs: jobs.on,
            pipeline: pipeline.on,
            interviews: interviews.on,
            offers: offers.on,
            onboarding: onboarding.on,
        },
    }
}
