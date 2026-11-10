import { Field, ID, InputType } from "@nestjs/graphql"
import { IsOptional, IsString, IsUUID, Matches, MaxLength } from "class-validator"

@InputType()
/** The preset picture to dress an agent in, or none for the default NIVO AI mark. */
export class SetAgentAvatarPresetInput {
    /** The agent. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    agentId!: string

    /** The preset (nivo-ai, role, initials, a shop mark); null goes back to the default. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @Matches(/^[a-z][a-z0-9-]{1,39}$/u)
    @MaxLength(40)
    preset: string | null = null
}
