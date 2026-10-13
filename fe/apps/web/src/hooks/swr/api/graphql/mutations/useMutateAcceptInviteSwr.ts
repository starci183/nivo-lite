import { mutateAcceptInvite } from "@/modules/api/graphql/mutations/mutation-accept-invite"
import { useGraphQLMutationSwr } from "@/hooks/reuseables"

/** The SWR key of the acceptInvite mutation. */
export const MUTATE_ACCEPT_INVITE_SWR_KEY = "MUTATE_ACCEPT_INVITE_SWR"

/** SWR mutation for {@link mutateAcceptInvite}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateAcceptInviteSwr = () =>
    useGraphQLMutationSwr(MUTATE_ACCEPT_INVITE_SWR_KEY, mutateAcceptInvite, (data) => data.acceptInvite)
