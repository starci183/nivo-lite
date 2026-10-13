import useSWRMutation from "swr/mutation"
import { mutateCreateLead } from "@/modules/api/graphql/mutations/mutation-create-lead"
import type { MutateCreateLeadRequest } from "@/modules/api/graphql/mutations/mutation-create-lead"

/** What the createLead mutation is triggered with. */
interface CreateLeadArg {
    readonly arg: MutateCreateLeadRequest
}

/** The SWR key of the createLead mutation. */
export const MUTATE_CREATE_LEAD_SWR_KEY = "MUTATE_CREATE_LEAD_SWR"

/** SWR mutation for {@link mutateCreateLead}: `trigger(request)` answers the result and rejects with the back end failure. */
export const useMutateCreateLeadSwr = () =>
    useSWRMutation(MUTATE_CREATE_LEAD_SWR_KEY, async (_key: string, { arg }: CreateLeadArg) => {
        const result = await mutateCreateLead({ request: arg })
        if (!result.data) throw new Error("createLead answered no data")
        return result.data.createLead
    })
