import useSWRMutation from "swr/mutation"
import { mutateSaveBrainLesson } from "@/modules/api/graphql/mutations/mutation-save-brain-lesson"
import type { MutateSaveBrainLessonRequest } from "@/modules/api/graphql/mutations/mutation-save-brain-lesson"

/** What the SaveBrainLesson mutation is triggered with. */
interface SaveBrainLessonArg {
    readonly arg: MutateSaveBrainLessonRequest
}

/** The SWR key of the saveBrainLesson mutation. */
export const MUTATE_SAVE_BRAIN_LESSON_SWR_KEY = "MUTATE_SAVE_BRAIN_LESSON_SWR"

/** SWR mutation for {@link mutateSaveBrainLesson}: Writes a lesson of the shared brain. `trigger(input)` rejects with the back end failure. */
export const useMutateSaveBrainLessonSwr = () =>
    useSWRMutation(MUTATE_SAVE_BRAIN_LESSON_SWR_KEY, async (_key: string, { arg }: SaveBrainLessonArg) => {
        const result = await mutateSaveBrainLesson({ request: arg })
        if (!result.data) throw new Error("saveBrainLesson answered no data")
        return result.data.saveBrainLesson
    })
