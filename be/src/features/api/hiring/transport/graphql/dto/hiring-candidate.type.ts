import { Field, ID, Int, ObjectType } from "@nestjs/graphql"
import { HiringAnswerType } from "./hiring-answer.type"
import { HiringScoreReasonType } from "./hiring-score-reason.type"

@ObjectType()
/** One candidate of the workbench, with the screening and notes. */
export class HiringCandidateType {
    /** The candidate id. */
    @Field(() => ID)
    id!: string

    /** The workspace. */
    @Field(() => ID)
    workspaceId!: string

    /** The job applied for. */
    @Field(() => ID)
    jobId!: string

    /** The candidate's name. */
    @Field(() => String)
    name!: string

    /** The phone, digits only. */
    @Field(() => String)
    phone!: string

    /** The email. */
    @Field(() => String)
    email!: string

    /** Where the application came from. */
    @Field(() => String)
    source!: string

    /** The chat conversation of a chat application. */
    @Field(() => ID, { nullable: true })
    conversationId!: string | null

    /** The stored CV file path. */
    @Field(() => String, { nullable: true })
    cvPath!: string | null

    /** The CV file name. */
    @Field(() => String, { nullable: true })
    cvName!: string | null

    /** The CV media type. */
    @Field(() => String, { nullable: true })
    cvMime!: string | null

    /** The answers. */
    @Field(() => [HiringAnswerType])
    answers!: ReadonlyArray<HiringAnswerType>

    /** The days and hours they can work. */
    @Field(() => String)
    availability!: string

    /** The stage. */
    @Field(() => String)
    stage!: string

    /** The staff profile created from this candidate. */
    @Field(() => ID, { nullable: true })
    staffId!: string | null

    /** The CV file size in bytes. */
    @Field(() => Int, { nullable: true })
    cvSize!: number | null

    /** The screening score, 0 to 100. */
    @Field(() => Int, { nullable: true })
    score!: number | null

    /** The screening verdict. */
    @Field(() => String, { nullable: true })
    scoreLabel!: string | null

    /** The screening's per-criterion findings. */
    @Field(() => [HiringScoreReasonType])
    scoreReasons!: ReadonlyArray<HiringScoreReasonType>

    /** The screening's one-paragraph summary. */
    @Field(() => String, { nullable: true })
    scoreSummary!: string | null

    /** When the screening ran. */
    @Field(() => String, { nullable: true })
    screenedAt!: string | null

    /** When the stage last changed. */
    @Field(() => String)
    stageChangedAt!: string

    /** Why a rejected candidate was refused. */
    @Field(() => String, { nullable: true })
    rejectedReason!: string | null

    /** The manager's private notes. */
    @Field(() => String)
    notes!: string

    /** When the application arrived. */
    @Field(() => String)
    createdAt!: string
}
