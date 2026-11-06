import { Field, ID, ObjectType } from "@nestjs/graphql"
import { ChatMemberKind } from "./chat-member-kind.type"

@ObjectType()
/** A member a message mentions. */
export class ChatMentionType {
    /** Person or agent. */
    @Field(() => ChatMemberKind)
    memberKind!: string

    /** The account id or the agent id. */
    @Field(() => ID)
    memberId!: string

    /** The name shown. */
    @Field(() => String)
    name!: string
}
