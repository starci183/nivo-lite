"use client"

import useSWRMutation from "swr/mutation"
import { mutateDecideBrainLesson } from "@/modules/api/graphql/mutations/mutation-decide-brain-lesson"
import type { MutateDecideBrainLessonRequest } from "@/modules/api/graphql/mutations/mutation-decide-brain-lesson"

/** What the DecideBrainLesson mutation is triggered with. */
interface DecideBrainLessonArg {
    readonly arg: MutateDecideBrainLessonRequest
}

/** The SWR key of the decideBrainLesson mutation. */
export const MUTATE_DECIDE_BRAIN_LESSON_SWR_KEY = "MUTATE_DECIDE_BRAIN_LESSON_SWR"

/** SWR mutation for {@link mutateDecideBrainLesson}: Activates, rejects or retires a lesson of the shared brain. `trigger(input)` rejects with the back end failure. */
export const useMutateDecideBrainLessonSwr = () =>
    useSWRMutation(MUTATE_DECIDE_BRAIN_LESSON_SWR_KEY, async (_key: string, { arg }: DecideBrainLessonArg) => {
        const result = await mutateDecideBrainLesson({ request: arg })
        if (!result.data) throw new Error("decideBrainLesson answered no data")
        return result.data.decideBrainLesson
    })
