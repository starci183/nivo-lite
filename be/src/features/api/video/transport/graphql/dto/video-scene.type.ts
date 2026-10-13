import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** Saved video-scene view. */
export class VideoSceneType {
    /** id of this video. */
    @Field(() => ID)
    id!: string

    /** role of this video. */
    @Field(() => String)
    role!: string

    /** caption of this video. */
    @Field(() => String)
    caption!: string

    /** voiceover of this video. */
    @Field(() => String)
    voiceover!: string

    /** visual of this video. */
    @Field(() => String)
    visual!: string

    /** media of this video. */
    @Field(() => String, { nullable: true })
    media!: string | null
}
