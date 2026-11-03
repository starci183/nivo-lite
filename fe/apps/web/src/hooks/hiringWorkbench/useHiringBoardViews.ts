"use client"
import { whenSelected } from "@/modules/utils"
import type { HiringSelectedViewInput } from "./hiringWorkbench.shared"

import { useHiringJobsView, type HiringJobsViewShape } from "./useHiringJobsView"
import { useHiringPipelineView, type HiringPipelineViewShape } from "./useHiringPipelineView"
import { useHiringInterviewsView, type HiringInterviewsViewShape } from "./useHiringInterviewsView"
import { useHiringOffersView, type HiringOffersViewShape } from "./useHiringOffersView"
import { useHiringOnboardingView, type HiringOnboardingViewShape } from "./useHiringOnboardingView"

/** The view `useHiringBoardViews` returns. */
export interface HiringBoardViewsView {
    props: {
        jobs: HiringJobsViewShape["props"]
        pipeline: HiringPipelineViewShape["props"]
        interviews: HiringInterviewsViewShape["props"]
        offers: HiringOffersViewShape["props"]
        onboarding: HiringOnboardingViewShape["props"]
    }
    on: {
        jobs: HiringJobsViewShape["on"]
        pipeline: HiringPipelineViewShape["on"]
        interviews: HiringInterviewsViewShape["on"]
        offers: HiringOffersViewShape["on"]
        onboarding: HiringOnboardingViewShape["on"]
    }
}

/** Keeps each controller tied to the exact tab that formerly mounted its block. */
export const useHiringBoardViews = (input: HiringSelectedViewInput): HiringBoardViewsView => {
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
