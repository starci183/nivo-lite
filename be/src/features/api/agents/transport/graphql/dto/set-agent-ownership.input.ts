import { Field, ID, InputType } from "@nestjs/graphql"
import { ArrayMaxSize, IsArray, IsIn, IsUUID, MaxLength } from "class-validator"

@InputType()
/** Replaces who is in charge of an agent and who may give it work. */
export class SetAgentOwnershipInput {
    /** The agent. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    agentId!: string

    /** The member in charge. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    ownerMemberId!: string

    /** The member who takes over when the owner left or is disabled. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    fallbackMemberId!: string

    /** The workspace roles that may hand the agent work. */
    @Field(() => [String])
    @IsArray()
    @ArrayMaxSize(3)
    @IsIn(["owner", "manager", "staff"], { each: true })
    assignableRoles!: Array<string>

    /** The ids of the team-chat groups whose members may hand the agent work. */
    @Field(() => [String])
    @IsArray()
    @ArrayMaxSize(10)
    @IsUUID("4", { each: true })
    assignableRooms!: Array<string>
}
