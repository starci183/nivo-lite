import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** Saved video-media view. */
export class VideoMediaType {
    /** path of this video. */
    @Field(() => String)
    path!: string

    /** name of this video. */
    @Field(() => String)
    name!: string

    /** kind of this video. */
    @Field(() => String)
    kind!: string

    /** url of this video. */
    @Field(() => String, { nullable: true })
    url!: string | null
}
