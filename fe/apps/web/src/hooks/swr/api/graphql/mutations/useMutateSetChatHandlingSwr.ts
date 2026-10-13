import { mutateSetChatHandling } from "@/modules/api/graphql/mutations/mutation-set-chat-handling"
import { useGraphQLMutationSwr } from "@/hooks/reuseables/useGraphQLMutationSwr"

/** The SWR key of the setChatHandling mutation. */
export const MUTATE_SET_CHAT_HANDLING_SWR_KEY = "MUTATE_SET_CHAT_HANDLING_SWR"

/** SWR mutation for {@link mutateSetChatHandling}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateSetChatHandlingSwr = () =>
    useGraphQLMutationSwr(MUTATE_SET_CHAT_HANDLING_SWR_KEY, mutateSetChatHandling, (data) => data.setChatHandling)
