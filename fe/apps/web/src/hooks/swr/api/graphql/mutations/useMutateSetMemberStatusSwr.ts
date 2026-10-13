import { mutateSetMemberStatus } from "@/modules/api/graphql/mutations/mutation-set-member-status"
import { useGraphQLMutationSwr } from "@/hooks/reuseables/useGraphQLMutationSwr"

/** The SWR key of the setMemberStatus mutation. */
export const MUTATE_SET_MEMBER_STATUS_SWR_KEY = "MUTATE_SET_MEMBER_STATUS_SWR"

/** SWR mutation for {@link mutateSetMemberStatus}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateSetMemberStatusSwr = () =>
    useGraphQLMutationSwr(MUTATE_SET_MEMBER_STATUS_SWR_KEY, mutateSetMemberStatus, (data) => data.setMemberStatus)
