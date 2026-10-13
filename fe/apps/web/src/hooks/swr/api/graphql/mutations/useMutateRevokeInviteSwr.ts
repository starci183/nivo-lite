import { mutateRevokeInvite } from "@/modules/api/graphql/mutations/mutation-revoke-invite"
import { useGraphQLMutationSwr } from "@/hooks/reuseables"

/** The SWR key of the revokeInvite mutation. */
export const MUTATE_REVOKE_INVITE_SWR_KEY = "MUTATE_REVOKE_INVITE_SWR"

/** SWR mutation for {@link mutateRevokeInvite}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateRevokeInviteSwr = () =>
    useGraphQLMutationSwr(MUTATE_REVOKE_INVITE_SWR_KEY, mutateRevokeInvite, (data) => data.revokeInvite)
