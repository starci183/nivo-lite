import { type HiringOwner, useHiringRun } from "@/hooks/hiring"
import { useMutateLinkHiringStaffSwr, useMutateToggleHiringOnboardingSwr } from "@/hooks/swr"

/** The view `useHiringOnboarding` returns. */
export interface HiringOnboardingView {
    isPending: boolean
    error: string | null
    clearError: () => void
    toggle: (id: string, done: boolean) => void
    linkStaff: (candidateId: string) => void
}

/** The onboarding checklists: tick a step, and make a hired candidate a staff profile. */
export const useHiringOnboarding = (owner?: HiringOwner): HiringOnboardingView => {
    const run = useHiringRun(owner)
    const { trigger: toggleTrigger } = useMutateToggleHiringOnboardingSwr()
    const { trigger: linkTrigger } = useMutateLinkHiringStaffSwr()
    return {
        isPending: run.isPending,
        error: run.error,
        clearError: run.clear,
        toggle: (id: string, done: boolean) => run.dispatch(() => toggleTrigger({ id, done })),
        linkStaff: (candidateId: string) => run.dispatch(() => linkTrigger({ id: candidateId })),
    }
}
