import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** Temporary links for viewing and downloading one media item. */
export class ContentMediaUrlType {
    /** The storage path or a video id prefixed with `video:`. */
    @Field()
    key!: string

    /** The URL used to view the media. */
    @Field()
    view!: string

    /** The URL used to download the media. */
    @Field()
    download!: string
}
