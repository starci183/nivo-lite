import {
    useQueryOfficeCommandCandidatesSwr,
    useQueryOfficeDecidedApprovalsSwr,
    useQueryOfficePendingApprovalsSwr,
} from "@/hooks/swr"
import { OFFICE_POLL_MS, toOfficeApproval, toOfficeCandidate } from "@/modules/office"

import type { OfficeCandidate, OfficeApproval } from "@/modules/office"
import type { SWRResponse, SWRConfiguration } from "swr"

const LIVE = { refreshInterval: OFFICE_POLL_MS }

type UseOfficeApprovalsResult = {
    approvalReads: (
        | SWRResponse<
              | {
                    agentName: string | null
                    agent_id: string | null
                    assignedStaffId: string | null
                    channel: string
                    created_at: string
                    decided_at: string | null
                    decided_by: string | null
                    draft: string
                    id: string
                    kind: string
                    leadId: string | null
                    leadName: string | null
                    nextAction: string
                    responsibility_id: string
                    status: string
                    work_item_id: string | null
                }[]
              | undefined,
              unknown,
              SWRConfiguration | undefined
          >
        | SWRResponse<
              | {
                    command: string
                    created_at: string
                    id: string
                    message_id: string
                    module: string
                    payload: unknown
                    refusal_detail: string | null
                    status: string
                    summary: string
                    work_item_id: string | null
                    shown: Array<{
                        key: string
                        label: string
                        value: string
                    }>
                }[]
              | undefined,
              unknown,
              SWRConfiguration | undefined
          >
    )[]
    reloadApprovals: () => void
    pending: OfficeApproval[]
    decided: OfficeApproval[]
    candidates: OfficeCandidate[]
    isLoading: boolean
    error: unknown
}

/** The approval requests (waiting and decided) and the command cards, read again every few seconds. Each authoritative read remains beside its projection; `isLoading` is true only while a read has nothing yet. */
export const useOfficeApprovals = (): UseOfficeApprovalsResult => {
    const pending = useQueryOfficePendingApprovalsSwr(LIVE)
    const decided = useQueryOfficeDecidedApprovalsSwr(LIVE)
    const candidates = useQueryOfficeCommandCandidatesSwr(LIVE)
    const error: unknown = pending.error ?? decided.error ?? candidates.error
    return {
        approvalReads: [pending, decided, candidates],
        reloadApprovals: (): void => {
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
