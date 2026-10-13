import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The signed upload destination for a validated media file. */
export class ContentMediaUploadType {
    /** The object's workspace-scoped storage path. */
    @Field()
    path!: string

    /** The original file name displayed to the user. */
    @Field()
    name!: string

    /** The token authorizing the storage upload. */
    @Field()
    token!: string

    /** The URL used to upload the file. */
    @Field()
    signedUrl!: string
}
