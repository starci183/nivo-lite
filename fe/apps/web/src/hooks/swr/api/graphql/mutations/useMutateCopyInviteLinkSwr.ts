import { mutateCopyInviteLink } from "@/modules/api/graphql/mutations/mutation-copy-invite-link"
import { useGraphQLMutationSwr } from "@/hooks/reuseables"

/** The SWR key of the copyInviteLink mutation. */
export const MUTATE_COPY_INVITE_LINK_SWR_KEY = "MUTATE_COPY_INVITE_LINK_SWR"

/** SWR mutation for {@link mutateCopyInviteLink}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateCopyInviteLinkSwr = () =>
    useGraphQLMutationSwr(MUTATE_COPY_INVITE_LINK_SWR_KEY, mutateCopyInviteLink, (data) => data.copyInviteLink)
