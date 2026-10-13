import {
    useMutateDraftLeadExecutionSwr,
    useMutateRefreshLeadContextSwr,
    useMutateSuggestLeadOwnerSwr,
} from "@/hooks/swr"
import { useLeadAction } from "./useLeadAction"

/** The queued actions the lead header and panels offer. */
export const useLeadActions = () => {
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
