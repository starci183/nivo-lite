import { mutateRequestChatAnswer } from "@/modules/api/graphql/mutations/mutation-request-chat-answer"
import { useGraphQLMutationSwr } from "@/hooks/reuseables"

/** The SWR key of the requestChatAnswer mutation. */
export const MUTATE_REQUEST_CHAT_ANSWER_SWR_KEY = "MUTATE_REQUEST_CHAT_ANSWER_SWR"

/** SWR mutation for {@link mutateRequestChatAnswer}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateRequestChatAnswerSwr = () =>
    useGraphQLMutationSwr(MUTATE_REQUEST_CHAT_ANSWER_SWR_KEY, mutateRequestChatAnswer, (data) => data.requestChatAnswer)
