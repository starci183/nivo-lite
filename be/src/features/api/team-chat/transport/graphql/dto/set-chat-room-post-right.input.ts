import { Field, ID, InputType } from "@nestjs/graphql"
import { IsBoolean, IsUUID, MaxLength } from "class-validator"

@InputType()
/** Grants or revokes an agent's right to post in a group. */
export class SetChatRoomPostRightInput {
    /** The group. */
    @Field(() => ID)
    @IsUUID("all")
    @MaxLength(36)
    roomId!: string

    /** The agent sitting in the group. */
    @Field(() => ID)
    @IsUUID("all")
    @MaxLength(36)
    agentId!: string

    /** True to grant the right, false to revoke it. */
    @Field(() => Boolean)
    @IsBoolean()
    mayPost!: boolean
}
