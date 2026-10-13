import { Field, ID, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** Where the study of an agent's corrections stands. */
export class LessonMiningStatusType {
    /** The command. */
    @Field(() => ID)
    id!: string

    /** `queued`, `running`, `done` or `failed`. */
    @Field(() => String)
    status!: string

    /** How many corrections there were. */
    @Field(() => Int, { nullable: true })
    corrections?: number | null

    /** How many were kept as new regression cases. */
    @Field(() => Int, { nullable: true })
    newCases?: number | null

    /** How many lessons were proposed. */
    @Field(() => Int, { nullable: true })
    proposed?: number | null

    /** Why nothing was proposed: `not_enough` or `model_unavailable`. */
    @Field(() => String, { nullable: true })
    reason?: string | null

    /** The stored code of why it failed. */
    @Field(() => String, { nullable: true })
    errorCode?: string | null
}
