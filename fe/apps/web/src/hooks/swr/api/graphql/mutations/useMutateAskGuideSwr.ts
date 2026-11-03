"use client"

import { mutateAskGuide } from "@/modules/api/graphql/mutations/mutation-ask-guide"
import type { mutateAskGuide as MutateAskGuideOperation } from "@/modules/api/graphql/mutations/mutation-ask-guide"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation from "swr/mutation"
import type { SWRMutationResponse } from "swr/mutation"
import type { OperationData } from "@/hooks/workspaceread"

/** The SWR key of the askGuide mutation. */
const MUTATE_ASK_GUIDE_SWR_KEY = "MUTATE_ASK_GUIDE_SWR"

/** SWR mutation for {@link mutateAskGuide}: `trigger(input)` answers the queued text and rejects with the back end failure. */
export const useMutateAskGuideSwr = (): SWRMutationResponse<
    OperationData<typeof mutateAskGuide>["askGuide"],
    Error,
    typeof MUTATE_ASK_GUIDE_SWR_KEY,
    TriggerArg["arg"]
> =>
    useSWRMutation(
        MUTATE_ASK_GUIDE_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateAskGuide({ request: arg }), MUTATE_ASK_GUIDE_SWR_KEY).askGuide,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateAskGuideOperation>[0]["request"]
}
