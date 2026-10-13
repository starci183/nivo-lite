import useSWRMutation from "swr/mutation"
import { mutatePostOfficeMessage } from "@/modules/api/graphql/mutations/mutation-post-office-message"
import type { MutatePostOfficeMessageRequest } from "@/modules/api/graphql/mutations/mutation-post-office-message"

/** What the PostOfficeMessage mutation is triggered with. */
interface PostOfficeMessageArg {
    readonly arg: MutatePostOfficeMessageRequest
}

/** The SWR key of {@link useMutatePostOfficeMessageSwr}. */
export const MUTATE_POST_OFFICE_MESSAGE_SWR_KEY = "MUTATE_POST_OFFICE_MESSAGE_SWR"

/** SWR mutation for {@link mutatePostOfficeMessage}: `trigger(request)` answers the payload and rejects with the back end failure. */
export const useMutatePostOfficeMessageSwr = () =>
    useSWRMutation(MUTATE_POST_OFFICE_MESSAGE_SWR_KEY, async (_key: string, { arg }: PostOfficeMessageArg) => {
        const result = await mutatePostOfficeMessage({ request: arg })
        if (!result.data) throw new Error("postOfficeMessage answered no data")
        return result.data.postOfficeMessage
    })
