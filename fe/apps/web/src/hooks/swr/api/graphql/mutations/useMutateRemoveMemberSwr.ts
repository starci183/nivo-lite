import { mutateRemoveMember } from "@/modules/api/graphql/mutations/mutation-remove-member"
import { useGraphQLMutationSwr } from "@/hooks/reuseables/useGraphQLMutationSwr"

/** The SWR key of the removeMember mutation. */
export const MUTATE_REMOVE_MEMBER_SWR_KEY = "MUTATE_REMOVE_MEMBER_SWR"

/** SWR mutation for {@link mutateRemoveMember}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateRemoveMemberSwr = () =>
    useGraphQLMutationSwr(MUTATE_REMOVE_MEMBER_SWR_KEY, mutateRemoveMember, (data) => data.removeMember)
