import { mutateDecideWorkItem } from "@/modules/api/graphql/mutations/mutation-decide-work-item"
import { useGraphQLMutationSwr } from "@/hooks/reuseables/useGraphQLMutationSwr"

/** The SWR key of the decideWorkItem mutation. */
export const MUTATE_DECIDE_WORK_ITEM_SWR_KEY = "MUTATE_DECIDE_WORK_ITEM_SWR"

/** SWR mutation for {@link mutateDecideWorkItem}: Approves or rejects a waiting work item. `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateDecideWorkItemSwr = () => useGraphQLMutationSwr(MUTATE_DECIDE_WORK_ITEM_SWR_KEY, mutateDecideWorkItem, (data) => data.decideWorkItem)
