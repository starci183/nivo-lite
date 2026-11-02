import {
    useQueryOfficeCommandCandidatesSwr,
    useQueryOfficeDecidedApprovalsSwr,
    useQueryOfficePendingApprovalsSwr,
} from "@/hooks/swr"
import { OFFICE_POLL_MS, toOfficeApproval, toOfficeCandidate } from "@/modules/office"

const LIVE = { refreshInterval: OFFICE_POLL_MS }

/** The approval requests (waiting and decided) and the command cards, read again every few seconds. Each authoritative read remains beside its projection; `isLoading` is true only while a read has nothing yet. */
export const useOfficeApprovals = () => {
    const pending = useQueryOfficePendingApprovalsSwr(LIVE)
    const decided = useQueryOfficeDecidedApprovalsSwr(LIVE)
    const candidates = useQueryOfficeCommandCandidatesSwr(LIVE)
    const error: unknown = pending.error ?? decided.error ?? candidates.error
    return {
        approvalReads: [pending, decided, candidates],
        reloadApprovals: () => {
            void pending.mutate()
            void decided.mutate()
            void candidates.mutate()
        },
        pending: pending.data?.map(toOfficeApproval) ?? [],
        decided: decided.data?.map(toOfficeApproval) ?? [],
        candidates: candidates.data?.map(toOfficeCandidate) ?? [],
        isLoading: pending.isLoading || decided.isLoading || candidates.isLoading,
        error,
    }
}
