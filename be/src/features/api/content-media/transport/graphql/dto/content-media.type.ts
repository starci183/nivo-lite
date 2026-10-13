import { Field, ObjectType } from "@nestjs/graphql"
import { ContentMediaRefType } from "./content-media-ref.type"
import { ContentMediaUrlType } from "./content-media-url.type"
import { ContentMediaVideoType } from "./content-media-video.type"

@ObjectType()
/** The media library and temporary links requested by the content workbench. */
export class ContentMediaType {
    /** The listable files in the workspace's media folder. */
    @Field(() => [ContentMediaRefType])
    library!: Array<ContentMediaRefType>

    /** The completed videos in the workspace. */
    @Field(() => [ContentMediaVideoType])
    videos!: Array<ContentMediaVideoType>

    /** Temporary links for the requested files and videos. */
    @Field(() => [ContentMediaUrlType])
    urls!: Array<ContentMediaUrlType>
}
