"use client"

import { useHiringSay } from "@/hooks/hiring"
import { useHiringOnboarding } from "@/hooks/hiringOnboarding"
import type { HiringWorkbenchData } from "@/hooks/hiringWire"
import { HiringOnboardingBase } from "./component"

/** The workbench the tab reads. */
interface HiringOnboardingProps {
    readonly data: HiringWorkbenchData
}

/** The connected onboarding tab: the hired people with their checklists, and the commands that tick a step or make a staff profile. */
export const HiringOnboarding = (props: HiringOnboardingProps) => {
    const say = useHiringSay()
    const view = useHiringOnboarding()
    const { data } = props
    const titles = new Map(data.jobs.map((job) => [job.id, job.title]))
    return (
        <HiringOnboardingBase
            props={{
                say,
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
            }}
            on={{ toggle: view.toggle, linkStaff: view.linkStaff, clearError: view.clearError }}
        />
    )
}
