import { Field, Int, ObjectType } from "@nestjs/graphql"
import { ContentAiWarningType } from "./content-ai-warning.type"

@ObjectType()
/** Queued content work, progress, applied result, or a stable failure code. */
export class ContentAiStatusType {
    /** id of the content operation. */
    @Field(() => String)
    id!: string

    /** status of the content operation. */
    @Field(() => String)
    status!: string

    /** progress of the content operation. */
    @Field(() => Int)
    progress!: number

    /** itemId of the content operation. */
    @Field(() => String, { nullable: true })
    itemId!: string | null

    /** planId of the content operation. */
    @Field(() => String, { nullable: true })
    planId!: string | null

    /** resultId of the content operation. */
    @Field(() => String, { nullable: true })
    resultId!: string | null

    /** ideas of the content operation. */
    @Field(() => Int, { nullable: true })
    ideas!: number | null

    /** seconds of the content operation. */
    @Field(() => Int, { nullable: true })
    seconds!: number | null

    /** skippedPast of the content operation. */
    @Field(() => Int, { nullable: true })
    skippedPast!: number | null

    /** warnings of the content operation. */
    @Field(() => [ContentAiWarningType])
    warnings!: Array<ContentAiWarningType>

    /** errorCode of the content operation. */
    @Field(() => String, { nullable: true })
    errorCode!: string | null
}
