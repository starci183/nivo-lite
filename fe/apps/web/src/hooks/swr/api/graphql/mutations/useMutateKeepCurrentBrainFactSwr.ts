import useSWRMutation from "swr/mutation"
import { mutateKeepCurrentBrainFact } from "@/modules/api/graphql/mutations/mutation-keep-current-brain-fact"
import type { MutateKeepCurrentBrainFactRequest } from "@/modules/api/graphql/mutations/mutation-keep-current-brain-fact"

/** What the KeepCurrentBrainFact mutation is triggered with. */
interface KeepCurrentBrainFactArg {
    readonly arg: MutateKeepCurrentBrainFactRequest
}

/** The SWR key of the keepCurrentBrainFact mutation. */
export const MUTATE_KEEP_CURRENT_BRAIN_FACT_SWR_KEY = "MUTATE_KEEP_CURRENT_BRAIN_FACT_SWR"

/** SWR mutation for {@link mutateKeepCurrentBrainFact}: Keeps the value in force and retires the proposals competing for it; answers how many proposals were retired. `trigger(input)` rejects with the back end failure. */
export const useMutateKeepCurrentBrainFactSwr = () =>
    useSWRMutation(MUTATE_KEEP_CURRENT_BRAIN_FACT_SWR_KEY, async (_key: string, { arg }: KeepCurrentBrainFactArg) => {
        const result = await mutateKeepCurrentBrainFact({ request: arg })
        if (!result.data) throw new Error("keepCurrentBrainFact answered no data")
        return result.data.keepCurrentBrainFact
    })
