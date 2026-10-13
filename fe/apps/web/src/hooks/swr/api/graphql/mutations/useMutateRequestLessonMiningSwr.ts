import useSWRMutation from "swr/mutation"
import { mutateRequestLessonMining } from "@/modules/api/graphql/mutations/mutation-request-lesson-mining"
import type { MutateRequestLessonMiningRequest } from "@/modules/api/graphql/mutations/mutation-request-lesson-mining"

/** What the RequestLessonMining mutation is triggered with. */
interface RequestLessonMiningArg {
    readonly arg: MutateRequestLessonMiningRequest
}

/** The SWR key of the requestLessonMining mutation. */
export const MUTATE_REQUEST_LESSON_MINING_SWR_KEY = "MUTATE_REQUEST_LESSON_MINING_SWR"

/** SWR mutation for {@link mutateRequestLessonMining}: Asks the back end to study the corrections of one agent; answers the command id `lessonMiningStatus` polls. `trigger(input)` rejects with the back end failure. */
export const useMutateRequestLessonMiningSwr = () =>
    useSWRMutation(MUTATE_REQUEST_LESSON_MINING_SWR_KEY, async (_key: string, { arg }: RequestLessonMiningArg) => {
        const result = await mutateRequestLessonMining({ request: arg })
        if (!result.data) throw new Error("requestLessonMining answered no data")
        return result.data.requestLessonMining
    })
