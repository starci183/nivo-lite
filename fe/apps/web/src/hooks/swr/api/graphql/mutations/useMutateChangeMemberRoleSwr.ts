import { mutateChangeMemberRole } from "@/modules/api/graphql/mutations/mutation-change-member-role"
import { useGraphQLMutationSwr } from "@/hooks/reuseables/useGraphQLMutationSwr"

/** The SWR key of the changeMemberRole mutation. */
export const MUTATE_CHANGE_MEMBER_ROLE_SWR_KEY = "MUTATE_CHANGE_MEMBER_ROLE_SWR"

/** SWR mutation for {@link mutateChangeMemberRole}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateChangeMemberRoleSwr = () =>
    useGraphQLMutationSwr(MUTATE_CHANGE_MEMBER_ROLE_SWR_KEY, mutateChangeMemberRole, (data) => data.changeMemberRole)
