import { Field, ObjectType, ID } from "@nestjs/graphql"

@ObjectType()
/** A stored image or rendered video attached to a post. */
export class ContentItemMediaType {
    /** The attachment kind: media or video_render. */
    @Field()
    kind!: string

    /** The display name. */
    @Field()
    name!: string

    /** The stored media path, when this is a media file. */
    @Field(() => String, { nullable: true })
    path!: string | null

    /** The rendered video id, when this is a video attachment. */
    @Field(() => ID, { nullable: true })
    id!: string | null

    /** Whether the AI suggested this attachment. */
    @Field()
    suggested!: boolean
}
