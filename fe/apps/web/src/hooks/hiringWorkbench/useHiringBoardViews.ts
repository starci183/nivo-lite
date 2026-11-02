"use client"
import type { HiringSelectedViewInput } from "./hiringWorkbench.shared"

import { useHiringJobsView } from "./useHiringJobsView"
import { useHiringPipelineView } from "./useHiringPipelineView"
import { useHiringInterviewsView } from "./useHiringInterviewsView"
import { useHiringOffersView } from "./useHiringOffersView"
import { useHiringOnboardingView } from "./useHiringOnboardingView"

/** Keeps each controller tied to the exact tab that formerly mounted its block. */
export const useHiringBoardViews = (input: HiringSelectedViewInput) => {
    const jobs = useHiringJobsView({ ...input, isActive: input.isActive && input.selected === "jobs" })
    const pipeline = useHiringPipelineView({ ...input, isActive: input.isActive && input.selected === "candidates" })
    const interviews = useHiringInterviewsView({
        ...input,
        isActive: input.isActive && input.selected === "interviews",
    })
    const offers = useHiringOffersView({ ...input, isActive: input.isActive && input.selected === "offers" })
    const onboarding = useHiringOnboardingView({
        ...input,
        isActive: input.isActive && input.selected === "onboarding",
    })
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
