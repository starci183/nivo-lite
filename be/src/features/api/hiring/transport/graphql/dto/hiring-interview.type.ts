import { Field, ID, Int, ObjectType } from "@nestjs/graphql"
import { HiringSlotType } from "./hiring-slot.type"

@ObjectType()
/** One interview of the workbench. */
export class HiringInterviewType {
    /** The interview id. */
    @Field(() => ID)
    id!: string

    /** The workspace. */
    @Field(() => ID)
    workspaceId!: string

    /** The candidate. */
    @Field(() => ID)
    candidateId!: string

    /** The job. */
    @Field(() => ID)
    jobId!: string

    /** The interviewer account. */
    @Field(() => ID, { nullable: true })
    interviewerUserId!: string | null

    /** The interviewer's name. */
    @Field(() => String)
    interviewerName!: string

    /** In person or online. */
    @Field(() => String)
    mode!: string

    /** The address, or the online link. */
    @Field(() => String)
    location!: string

    /** The length in minutes. */
    @Field(() => Int)
    durationMin!: number

    /** The times offered to the candidate. */
    @Field(() => [HiringSlotType])
    proposedSlots!: ReadonlyArray<HiringSlotType>

    /** The confirmed start. */
    @Field(() => String, { nullable: true })
    slotStart!: string | null

    /** The confirmed end. */
    @Field(() => String, { nullable: true })
    slotEnd!: string | null

    /** The status. */
    @Field(() => String)
    status!: string

    /** The token in the candidate's link. */
    @Field(() => String)
    token!: string

    /** The decision that allowed the invitation. */
    @Field(() => ID, { nullable: true })
    workItemId!: string | null

    /** A note from the candidate. */
    @Field(() => String)
    note!: string

    /** When the reminder went out. */
    @Field(() => String, { nullable: true })
    reminderSentAt!: string | null

    /** When it was created. */
    @Field(() => String)
    createdAt!: string
}
