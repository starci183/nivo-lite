import { useMutateCreateLeadSwr } from "@/hooks/swr"
import { useLeadAction } from "./useLeadAction"

/** What the new-lead form submits. */
interface NewLeadInput {
    readonly contact_name: string
    readonly company: string
    readonly channel: string
    readonly need: string
}

/** Captures a lead: queues the creation and observes its job; `result.leadId` appears once the lead exists. */
export const useCreateLead = () => {
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
