import { useMutateCreateLeadSwr } from "@/hooks/swr"
import { useLeadAction } from "./useLeadAction"
import type { LeadActionQueuedType } from "@/modules/api"

/** What the new-lead form submits. */
interface NewLeadInput {
    readonly contact_name: string
    readonly company: string
    readonly channel: string
    readonly need: string
}

/** The view `useCreateLead` returns. */
export interface CreateLeadView {
    create: (input: NewLeadInput) => Promise<
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

/** Creates a customer and their follow-up through the core queued flow; `result.leadId` appears once they exist. */
export const useCreateLead = (): CreateLeadView => {
    const action = useLeadAction()
    const mutation = useMutateCreateLeadSwr()
    return {
        ...action,
        create: (input: NewLeadInput) =>
            action.run(() =>
                mutation.trigger({
                    contactName: input.contact_name,
                    company: input.company,
                    channel: input.channel,
                    need: input.need,
                }),
            ),
    }
}
