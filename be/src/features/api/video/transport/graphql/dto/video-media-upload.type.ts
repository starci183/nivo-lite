import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** Saved video-media-upload view. */
export class VideoMediaUploadType {
    /** path of this video. */
    @Field(() => String)
    path!: string

    /** token of this video. */
    @Field(() => String)
    token!: string

    /** signedUrl of this video. */
    @Field(() => String)
    signedUrl!: string
}
