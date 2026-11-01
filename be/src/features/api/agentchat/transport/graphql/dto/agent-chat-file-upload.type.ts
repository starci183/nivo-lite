import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** Where the browser uploads a file of a chat message. */
export class AgentChatFileUploadType {
    /** The object path to name when the message is sent. */
    @Field()
    path!: string

    /** The presigned address. */
    @Field()
    signedUrl!: string
}
