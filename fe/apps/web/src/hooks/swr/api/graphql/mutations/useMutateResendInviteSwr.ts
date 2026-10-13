import { mutateResendInvite } from "@/modules/api/graphql/mutations/mutation-resend-invite"
import { useGraphQLMutationSwr } from "@/hooks/reuseables/useGraphQLMutationSwr"

/** The SWR key of the resendInvite mutation. */
export const MUTATE_RESEND_INVITE_SWR_KEY = "MUTATE_RESEND_INVITE_SWR"

/** SWR mutation for {@link mutateResendInvite}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateResendInviteSwr = () =>
    useGraphQLMutationSwr(MUTATE_RESEND_INVITE_SWR_KEY, mutateResendInvite, (data) => data.resendInvite)
