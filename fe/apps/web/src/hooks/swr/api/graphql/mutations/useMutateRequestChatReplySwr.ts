import { mutateRequestChatReply } from "@/modules/api/graphql/mutations/mutation-request-chat-reply"
import { useGraphQLMutationSwr } from "@/hooks/reuseables"

/** The SWR key of the requestChatReply mutation. */
export const MUTATE_REQUEST_CHAT_REPLY_SWR_KEY = "MUTATE_REQUEST_CHAT_REPLY_SWR"

/** SWR mutation for {@link mutateRequestChatReply}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateRequestChatReplySwr = () =>
    useGraphQLMutationSwr(MUTATE_REQUEST_CHAT_REPLY_SWR_KEY, mutateRequestChatReply, (data) => data.requestChatReply)
