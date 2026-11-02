import type { OfficeBoard } from "./office.shared"
import { useOfficeApprovals } from "./useOfficeApprovals"
import { useOfficeTeam } from "./useOfficeTeam"
import { useOfficeWork } from "./useOfficeWork"

/** Everything around the thread, read in the browser from the back end. `isLoading` is true only while a read has nothing yet. */
export const useOfficeBoard = (): OfficeBoard & { readonly isLoading: boolean; readonly error: unknown } => {
    const approvals = useOfficeApprovals()
    const work = useOfficeWork()
    const team = useOfficeTeam()
    return {
        ...approvals,
        ...work,
        ...team,
        reload: () => {
            approvals.reloadApprovals()
            work.reloadWork()
            team.reloadTeam()
        },
        isLoading: approvals.isLoading || work.isLoading || team.isLoading,
        error: approvals.error ?? work.error ?? team.error,
    }
}
