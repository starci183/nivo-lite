import { mutateCreateInvite } from "@/modules/api/graphql/mutations/mutation-create-invite"
import { useGraphQLMutationSwr } from "@/hooks/reuseables"

/** The SWR key of the createInvite mutation. */
export const MUTATE_CREATE_INVITE_SWR_KEY = "MUTATE_CREATE_INVITE_SWR"

/** SWR mutation for {@link mutateCreateInvite}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateCreateInviteSwr = () =>
    useGraphQLMutationSwr(MUTATE_CREATE_INVITE_SWR_KEY, mutateCreateInvite, (data) => data.createInvite)
