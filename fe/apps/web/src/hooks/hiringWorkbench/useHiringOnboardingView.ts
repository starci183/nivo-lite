"use client"
import { useHiringSay } from "@/hooks/hiring"
import { useHiringOnboarding } from "@/hooks/hiringOnboarding"
import type { HiringViewInput } from "./hiringWorkbench.shared"

type ResolvedActions = {
    readonly toggle: (id: string, done: boolean) => void
    readonly linkStaff: (candidateId: string) => void
    readonly clearError: () => void
}

/** Owns HiringOnboarding's resolved data, commands and actual panel activation. */
export const useHiringOnboardingView = (input: HiringViewInput) => {
    const owner = { isActive: input.isActive && input.isReady, scope: input.scope }

    const say = useHiringSay()
    const view = useHiringOnboarding(owner)
    const data = input.board
    const titles = new Map(data.jobs.map((job) => [job.id, job.title]))

    const props = {
        copy: {
            title: say("onbTitle"),
            emptyTitle: say("onbEmptyTitle"),
            emptyBody: say("onbEmptyBody"),
            errorTitle: say("errorNotSaved"),
            dismissLabel: say("dismiss"),
            hasStaffLabel: say("onbHasStaff"),
            createStaffLabel: say("onbCreateStaff"),
            progressLabel: say("onbProgress"),
        },
        people: data.candidates
            .filter((candidate) => candidate.stage === "hired")
            .map((candidate) => {
                const steps = data.onboarding.filter((step) => step.candidateId === candidate.id)
                return {
                    id: candidate.id,
                    name: candidate.name,
                    job: titles.get(candidate.jobId) ?? "",
                    contact: [candidate.phone, candidate.email].filter((line) => line !== "").join(" · "),
                    hasStaff: candidate.staffId !== null,
                    done: steps.filter((step) => step.done).length,
                    steps: steps.map((step) => ({ id: step.id, title: step.title, isDone: step.done })),
                }
            }),
        isBusy: view.isPending,
        error: view.error,
    }
    const on: ResolvedActions = { toggle: view.toggle, linkStaff: view.linkStaff, clearError: view.clearError }
    return { props, on }
}
