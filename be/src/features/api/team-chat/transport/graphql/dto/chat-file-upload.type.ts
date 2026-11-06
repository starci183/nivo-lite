import { Field, ObjectType } from "@nestjs/graphql"
import { ChatUploadHeaderType } from "./chat-upload-header.type"

@ObjectType()
/** Where a browser sends the bytes of one file, and the key a message names it by. */
export class ChatFileUploadType {
    /** The key to name in sendChatMessage. */
    @Field(() => String)
    fileKey!: string

    /** The address to send the bytes to. */
    @Field(() => String)
    uploadUrl!: string

    /** The HTTP method. */
    @Field(() => String)
    method!: string

    /** The headers the upload must carry. */
    @Field(() => [ChatUploadHeaderType])
    headers!: ReadonlyArray<ChatUploadHeaderType>

    /** When the address stops working. */
    @Field(() => String)
    expiresAt!: string
}
