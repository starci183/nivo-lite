import useSWRMutation from "swr/mutation"
import { mutateDismissKnowledgeGap } from "@/modules/api/graphql/mutations/mutation-dismiss-knowledge-gap"
import type { MutateDismissKnowledgeGapRequest } from "@/modules/api/graphql/mutations/mutation-dismiss-knowledge-gap"

/** What the DismissKnowledgeGap mutation is triggered with. */
interface DismissKnowledgeGapArg {
    readonly arg: MutateDismissKnowledgeGapRequest
}

/** The SWR key of the dismissKnowledgeGap mutation. */
export const MUTATE_DISMISS_KNOWLEDGE_GAP_SWR_KEY = "MUTATE_DISMISS_KNOWLEDGE_GAP_SWR"

/** SWR mutation for {@link mutateDismissKnowledgeGap}: Dismisses a question the agents could not answer. `trigger(input)` rejects with the back end failure. */
export const useMutateDismissKnowledgeGapSwr = () =>
    useSWRMutation(MUTATE_DISMISS_KNOWLEDGE_GAP_SWR_KEY, async (_key: string, { arg }: DismissKnowledgeGapArg) => {
        const result = await mutateDismissKnowledgeGap({ request: arg })
        if (!result.data) throw new Error("dismissKnowledgeGap answered no data")
        return result.data.dismissKnowledgeGap
    })
