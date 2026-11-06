import { Field, ID, InputType } from "@nestjs/graphql"
import { IsIn, IsUUID, MaxLength } from "class-validator"
import { ChatMemberKind } from "./chat-member-kind.type"

@InputType()
/** A person or an agent named by kind and id. */
export class ChatMemberRefInput {
    /** memberKind */
    @Field(() => ChatMemberKind)
    @IsIn(["user", "agent"])
    @MaxLength(10)
    memberKind!: string

    /** memberId */
    @Field(() => ID)
    @IsUUID("all")
    @MaxLength(36)
    memberId!: string
}
