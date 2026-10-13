import { Field, ObjectType } from "@nestjs/graphql"
import { HiringEventType } from "./hiring-event.type"
import { HiringCvType } from "./hiring-cv.type"

@ObjectType()
/** What the candidate drawer opens with. */
export class HiringCandidateDetailType {
    /** The candidate's timeline. */
    @Field(() => [[HiringEventType]])
    events!: ReadonlyArray<HiringEventType>

    /** The CV link, when there is one. */
    @Field(() => HiringCvType, { nullable: true })
    cv!: HiringCvType | null
}
