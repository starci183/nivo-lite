import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One header the upload must carry. */
export class ChatUploadHeaderType {
    /** The header name. */
    @Field(() => String)
    name!: string

    /** The header value. */
    @Field(() => String)
    value!: string
}
