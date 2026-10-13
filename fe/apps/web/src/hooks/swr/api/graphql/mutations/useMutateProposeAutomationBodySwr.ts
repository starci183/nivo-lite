import useSWRMutation from "swr/mutation"
import { mutateProposeAutomationBody } from "@/modules/api/graphql/mutations/mutation-propose-automation-body"
import type { MutateProposeAutomationBodyRequest } from "@/modules/api/graphql/mutations/mutation-propose-automation-body"

/** What the ProposeAutomationBody mutation is triggered with. */
interface ProposeAutomationBodyArg {
    readonly arg: MutateProposeAutomationBodyRequest
}

/** The SWR key of the propose automation body mutation. */
export const MUTATE_PROPOSE_AUTOMATION_BODY_SWR_KEY = "MUTATE_PROPOSE_AUTOMATION_BODY_SWR"

/** SWR mutation for {@link mutateProposeAutomationBody}: `trigger({ templateKey })` answers the proposed wording. */
export const useMutateProposeAutomationBodySwr = () =>
    useSWRMutation(
        MUTATE_PROPOSE_AUTOMATION_BODY_SWR_KEY,
        async (_key: string, { arg }: ProposeAutomationBodyArg) => {
            const result = await mutateProposeAutomationBody({ request: arg })
            if (!result.data) throw new Error("proposeAutomationBody answered no data")
            return result.data.proposeAutomationBody
        },
    )
