import { Field, ID, ObjectType } from "@nestjs/graphql"
import { ChatMemberKind } from "./chat-member-kind.type"
import { ChatMemberRole } from "./chat-member-role.type"

@ObjectType()
/** A person or an agent in a room. */
export class ChatMemberType {
    /** Person or agent. */
    @Field(() => ChatMemberKind)
    memberKind!: string

    /** The account id or the agent id. */
    @Field(() => ID)
    memberId!: string

    /** The name shown. */
    @Field(() => String)
    name!: string

    /** Owner or member. */
    @Field(() => ChatMemberRole)
    role!: string

    /** Where the member last read. */
    @Field(() => String, { nullable: true })
    lastReadAt!: string | null

    /** Whether the member muted the room. */
    @Field(() => Boolean)
    muted!: boolean

    /** Whether an agent holds the right to post in this group; always false for a person. */
    @Field(() => Boolean)
    mayPost!: boolean
}
