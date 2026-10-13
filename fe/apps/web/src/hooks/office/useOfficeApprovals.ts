import { useQueryOfficeCommandCandidatesSwr } from "@/hooks/swr/api/graphql/queries/useQueryOfficeCommandCandidatesSwr"
import { useQueryOfficeDecidedApprovalsSwr } from "@/hooks/swr/api/graphql/queries/useQueryOfficeDecidedApprovalsSwr"
import { useQueryOfficePendingApprovalsSwr } from "@/hooks/swr/api/graphql/queries/useQueryOfficePendingApprovalsSwr"
import { OFFICE_POLL_MS, toOfficeApproval, toOfficeCandidate } from "@/modules/office"

const LIVE = { refreshInterval: OFFICE_POLL_MS }

/** The approval requests (waiting and decided) and the command cards, read again every few seconds. A failed read reads as empty. */
export const useOfficeApprovals = () => {
    const pending = useQueryOfficePendingApprovalsSwr(LIVE)
    const decided = useQueryOfficeDecidedApprovalsSwr(LIVE)
    const candidates = useQueryOfficeCommandCandidatesSwr(LIVE)
    return {
        pending: pending.data?.map(toOfficeApproval) ?? [],
        decided: decided.data?.map(toOfficeApproval) ?? [],
        candidates: candidates.data?.map(toOfficeCandidate) ?? [],
    }
}
