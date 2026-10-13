import type { OfficeBoard } from "./office.shared"
import { useOfficeApprovals } from "./useOfficeApprovals"
import { useOfficeTeam } from "./useOfficeTeam"
import { useOfficeWork } from "./useOfficeWork"

/** Everything around the thread, read in the browser from the back end. */
export const useOfficeBoard = (): OfficeBoard => {
    const approvals = useOfficeApprovals()
    const work = useOfficeWork()
    const team = useOfficeTeam()
    return { ...approvals, ...work, ...team }
}
