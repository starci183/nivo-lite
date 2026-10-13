import { useHiringRun } from "@/hooks/hiring"
import { useMutateLinkHiringStaffSwr } from "@/hooks/swr/api/graphql/mutations/useMutateLinkHiringStaffSwr"
import { useMutateToggleHiringOnboardingSwr } from "@/hooks/swr/api/graphql/mutations/useMutateToggleHiringOnboardingSwr"

/** The onboarding checklists: tick a step, and make a hired candidate a staff profile. */
export const useHiringOnboarding = () => {
    const run = useHiringRun()
    const { trigger: toggleTrigger } = useMutateToggleHiringOnboardingSwr()
    const { trigger: linkTrigger } = useMutateLinkHiringStaffSwr()
    return {
        isPending: run.isPending,
        error: run.error,
        clearError: run.clear,
        toggle: (id: string, done: boolean) => void run.exec(() => toggleTrigger({ id, done })),
        linkStaff: (candidateId: string) => void run.exec(() => linkTrigger({ id: candidateId })),
    }
}
