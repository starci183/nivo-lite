import { useQueryWorkItemsSwr } from "@/hooks/swr"
import {
    DECIDED_CARDS_SHOWN,
    DECIDED_WORK_LIMIT,
    DECIDED_WORK_STATUSES,
    OFFICE_POLL_MS,
    OPEN_WORK_LIMIT,
    OPEN_WORK_STATUSES,
    toOfficeWork,
} from "@/modules/office"

import type { OfficeWork } from "@/modules/office"
import type { SWRResponse, SWRConfiguration } from "swr"

const LIVE = { refreshInterval: OFFICE_POLL_MS }

type UseOfficeWorkResult = {
    workReads: SWRResponse<
        {
            items: Array<{
                action: string
                assigned_staff_id: string | null
                chain_id: string | null
                completed_at: string | null
                created_at: string
                decided_path: string | null
                department: string
                depth: number
                error: string | null
                evidence_state: string
                execution_id: string | null
                id: string
                inbound_event_id: string | null
                installation_id: string | null
                lead_id: string | null
                missing_fields: Array<string>
                parent_id: string | null
                reason: string | null
                reasons: Array<string>
                status: string
                subject_id: string | null
                subject_type: string
                updated_at: string
                workspace_id: string
                proposal: {
                    amount_vnd: number | null
                    confidence: number | null
                    draft: string | null
                    fields: unknown
                    outcome: string | null
                    summary: string
                    candidates: Array<{
                        amount_vnd: number
                        id: string
                        label: string
                    }> | null
                }
                result: {
                    href: string | null
                    summary: string
                } | null
            }>
            next: {
                createdAt: string
                id: string
            } | null
        },
        unknown,
        SWRConfiguration | undefined
    >[]
    reloadWork: () => void
    exceptions: OfficeWork[]
    decidedCards: OfficeWork[]
    isLoading: boolean
    error: unknown
}

/** The work items the thread shows as cards: the open ones, and the recently decided ones as a record. */
export const useOfficeWork = (): UseOfficeWorkResult => {
    const open = useQueryWorkItemsSwr({ statuses: [...OPEN_WORK_STATUSES], limit: OPEN_WORK_LIMIT }, LIVE)
    const done = useQueryWorkItemsSwr({ statuses: [...DECIDED_WORK_STATUSES], limit: DECIDED_WORK_LIMIT }, LIVE)
    const error: unknown = open.error ?? done.error
    return {
        workReads: [open, done],
        reloadWork: (): void => {
            void open.mutate()
            void done.mutate()
        },
        exceptions: (open.data?.items.map(toOfficeWork) ?? [])
            .filter((work) => work.executionId === null)
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
        decidedCards: (done.data?.items.map(toOfficeWork) ?? [])
            .filter((work) => work.executionId === null && work.decidedPath === "human")
            .slice(0, DECIDED_CARDS_SHOWN),
        isLoading: open.isLoading || done.isLoading,
        error,
    }
}
