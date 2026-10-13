import { Module } from "@nestjs/common"
import { DecideFactHandler } from "./application/decide-fact.handler"
import { DecideLessonHandler } from "./application/decide-lesson.handler"
import { DismissGapHandler } from "./application/dismiss-gap.handler"
import { KeepCurrentHandler } from "./application/keep-current.handler"
import { MaintainBrainHandler } from "./application/maintain-brain.handler"
import { MineLessonsHandler } from "./application/mine-lessons.handler"
import { SaveFactHandler } from "./application/save-fact.handler"
import { SaveLessonHandler } from "./application/save-lesson.handler"

@Module({
    providers: [
        DecideFactHandler,
        DecideLessonHandler,
        DismissGapHandler,
        KeepCurrentHandler,
        MaintainBrainHandler,
        MineLessonsHandler,
        SaveFactHandler,
        SaveLessonHandler,
    ],
})
/** The brain feature: the handlers of its application. */
export class BrainApiModule {}
