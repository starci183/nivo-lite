import { Field, ObjectType } from "@nestjs/graphql"
import { ChatFileUploadType } from "./chat-file-upload.type"
import { ChatRefusal } from "./chat-refusal.type"

@ObjectType()
/** An upload address or why the mutation refused. */
export class ChatFileUploadPayloadType {
    /** The upload. */
    @Field(() => ChatFileUploadType, { nullable: true })
    upload!: ChatFileUploadType | null

    /** Why it refused. */
    @Field(() => ChatRefusal, { nullable: true })
    refusal!: string | null
}
