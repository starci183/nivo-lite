import {
    useMutateDraftLeadExecutionSwr,
    useMutateRefreshLeadContextSwr,
    useMutateSuggestLeadOwnerSwr,
} from "@/hooks/swr"
import { useLeadAction } from "./useLeadAction"
import type { LeadActionQueuedType } from "@/modules/api"

/** The view `useLeadActions` returns. */
export interface LeadActionsView {
    refreshContext: (leadId: string) => Promise<
        | {
              id: string
              status: string
          }
        | undefined
    >
    suggestOwner: (leadId: string) => Promise<
        | {
              id: string
              status: string
          }
        | undefined
    >
    draftExecution: (responsibilityId: string) => Promise<
        | {
              id: string
              status: string
          }
        | undefined
    >
    run: (action: () => Promise<LeadActionQueuedType>) => Promise<
        | {
              id: string
              status: string
          }
        | undefined
    >
    error: string | null
    result:
        | {
              contextSummary: string | null
              executionId: string | null
              leadId: string | null
              responsibilityId: string | null
              workItemId: string | null
          }
        | null
        | undefined
    isPending: boolean
    jobId: string | undefined
}

/** The queued actions the lead header and panels offer. */
export const useLeadActions = (): LeadActionsView => {
    const refresh = useMutateRefreshLeadContextSwr()
    const suggest = useMutateSuggestLeadOwnerSwr()
    const draft = useMutateDraftLeadExecutionSwr()
    const action = useLeadAction()
    return {
        ...action,
        refreshContext: (leadId: string) => action.run(() => refresh.trigger({ leadId })),
        suggestOwner: (leadId: string) => action.run(() => suggest.trigger({ leadId })),
        draftExecution: (responsibilityId: string) => action.run(() => draft.trigger({ responsibilityId })),
    }
}
