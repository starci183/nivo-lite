import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A file sent with a message. */
export class ChatAttachmentType {
    /** The key of the stored file. */
    @Field(() => String)
    fileKey!: string

    /** The file name. */
    @Field(() => String)
    name!: string

    /** The file type. */
    @Field(() => String)
    mimeType!: string

    /** The size in bytes. */
    @Field(() => Int)
    sizeBytes!: number

    /** A short-lived signed address to read it. */
    @Field(() => String)
    url!: string
}
