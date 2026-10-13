import { Field, Int, ObjectType } from "@nestjs/graphql"
import { PublicSlotType } from "./public-slot.type"

@ObjectType()
/** An interview read from the candidate's link. */
export class PublicInterviewType {
    /** The interview status. */
    @Field(() => String)
    status!: string

    /** The candidate. */
    @Field(() => String)
    candidateName!: string

    /** The job. */
    @Field(() => String)
    jobTitle!: string

    /** The business. */
    @Field(() => String)
    shop!: string

    /** In person or online. */
    @Field(() => String)
    mode!: string

    /** The address or link. */
    @Field(() => String)
    location!: string

    /** The length in minutes. */
    @Field(() => Int)
    durationMin!: number

    /** The interviewer. */
    @Field(() => String)
    interviewerName!: string

    /** The confirmed time. */
    @Field(() => String, { nullable: true })
    slotStart!: string | null

    /** The candidate's note. */
    @Field(() => String)
    note!: string

    /** The offered times. */
    @Field(() => [PublicSlotType])
    proposedSlots!: ReadonlyArray<PublicSlotType>
}
