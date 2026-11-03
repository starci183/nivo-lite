import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A signed place to upload a CV. */
export class CreateCvUploadType {
    /** The storage path to send with the application. */
    @Field(() => String)
    path!: string

    /** The upload token. */
    @Field(() => String)
    token!: string

    /** The content type the address is signed for: the upload must send exactly this `Content-Type`. */
    @Field(() => String)
    contentType!: string
}
