import { Field, Float, ID, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The public progress and output of a workspace render. */
export class VideoRenderStatusType {
    /** The render id. */
    @Field(() => ID)
    id!: string
    /** queued, running, succeeded or failed. */
    @Field()
    status!: string
    /** The completed percentage. */
    @Field(() => Int)
    progress!: number
    /** The renderer stage code. */
    @Field(() => String, { nullable: true })
    stage!: string | null
    /** The finished MP4 path in the videos bucket. */
    @Field(() => String, { nullable: true })
    outputPath!: string | null
    /** The finished poster path in the videos bucket. */
    @Field(() => String, { nullable: true })
    posterPath!: string | null
    /** The finished video duration in milliseconds. */
    @Field(() => Int, { nullable: true })
    durationMs!: number | null
    /** The finished MP4 size in bytes. */
    @Field(() => Float, { nullable: true })
    sizeBytes!: number | null
    /** The stable failure code, never internal renderer prose. */
    @Field(() => String, { nullable: true })
    errorCode!: string | null
}
