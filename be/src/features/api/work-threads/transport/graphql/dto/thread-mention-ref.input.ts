import { Field, InputType } from "@nestjs/graphql"
import { IsIn, IsString, MaxLength, MinLength } from "class-validator"

@InputType()
/** One tag the author chose in the composer: a member, an agent or a group. */
export class ThreadMentionRefInput {
    /** member, agent or group. */
    @Field()
    @IsIn(["member", "agent", "group"])
    kind!: "member" | "agent" | "group"

    /** The member's Auth user id, the agent id, or the group id (role:manager, room:sales). */
    @Field()
    @IsString()
    @MinLength(1)
    @MaxLength(80)
    id!: string
}
