import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** Saved video-source view. */
export class VideoSourceType {
    /** id of this video. */
    @Field(() => ID)
    id!: string

    /** title of this video. */
    @Field(() => String)
    title!: string

    /** topic of this video. */
    @Field(() => String, { nullable: true })
    topic!: string | null

    /** excerpt of this video. */
    @Field(() => String)
    excerpt!: string
}
