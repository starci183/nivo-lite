import { Field, ID, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** Saved video-render view. */
export class VideoRenderType {
    /** id of this video. */
    @Field(() => ID)
    id!: string

    /** status of this video. */
    @Field(() => String)
    status!: string

    /** progress of this video. */
    @Field(() => Int)
    progress!: number

    /** stage of this video. */
    @Field(() => String, { nullable: true })
    stage!: string | null

    /** durationMs of this video. */
    @Field(() => Int, { nullable: true })
    durationMs!: number | null

    /** sizeBytes of this video. */
    @Field(() => Int, { nullable: true })
    sizeBytes!: number | null

    /** errorCode of this video. */
    @Field(() => String, { nullable: true })
    errorCode!: string | null

    /** videoUrl of this video. */
    @Field(() => String, { nullable: true })
    videoUrl!: string | null

    /** Timed caption artifact, when this render produced one. */
    @Field(() => String, { nullable: true })
    captionsUrl!: string | null

    /** Recorded caption locale, when known. */
    @Field(() => String, { nullable: true })
    captionsLang!: string | null

    /** downloadUrl of this video. */
    @Field(() => String, { nullable: true })
    downloadUrl!: string | null

    /** posterUrl of this video. */
    @Field(() => String, { nullable: true })
    posterUrl!: string | null
}
