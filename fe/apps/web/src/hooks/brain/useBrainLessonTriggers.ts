import { useMutateDecideBrainLessonSwr, useMutateMaintainBrainSwr, useMutateSaveBrainLessonSwr } from "@/hooks/swr"
import type { MutateDecideBrainLessonRequest } from "@/modules/api/graphql/mutations/mutation-decide-brain-lesson"
import type { MutateSaveBrainLessonRequest } from "@/modules/api/graphql/mutations/mutation-save-brain-lesson"

/** The requests of the commands about lessons and upkeep, by the kind a card names. */
export interface BrainLessonRequests {
    readonly "lesson.save": MutateSaveBrainLessonRequest
    readonly "lesson.decide": MutateDecideBrainLessonRequest
    readonly "brain.maintain": undefined
}

/** The triggers of the lesson and upkeep commands, each typed by its own request. */
export interface BrainLessonTriggers {
    readonly isPending: boolean
    readonly triggers: {
        readonly [Kind in keyof BrainLessonRequests]: (request: BrainLessonRequests[Kind]) => Promise<unknown>
    }
}

/** The SWR mutations behind the commands that save and decide lessons and tidy the brain. */
export const useBrainLessonTriggers = (): BrainLessonTriggers => {
    const saveLesson = useMutateSaveBrainLessonSwr()
    const decideLesson = useMutateDecideBrainLessonSwr()
    const maintain = useMutateMaintainBrainSwr()
    return {
        isPending: saveLesson.isMutating || decideLesson.isMutating || maintain.isMutating,
        triggers: {
            "lesson.save": saveLesson.trigger,
            "lesson.decide": decideLesson.trigger,
            "brain.maintain": maintain.trigger,
        },
    }
}
