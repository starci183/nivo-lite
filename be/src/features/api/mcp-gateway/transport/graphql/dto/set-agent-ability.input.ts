import { Field, ID, InputType } from "@nestjs/graphql"
import { IsIn, IsString, IsUUID, Matches, MaxLength } from "class-validator"

@InputType()
/** Ticks or unticks one ability of an agent on a provider it is attached to. */
export class SetAgentAbilityInput {
    /** The agent. */
    @Field(() => ID)
    @IsString()
    @MaxLength(36)
    @IsUUID()
    agentId!: string

    /** The connected account: the connection id. */
    @Field(() => ID)
    @IsString()
    @MaxLength(36)
    @IsUUID()
    connectionId!: string

    /** The ability id. */
    @Field(() => String)
    @IsString()
    @MaxLength(41)
    @Matches(/^[a-z][a-z0-9.-]{1,40}$/u)
    ability!: string

    /** off (not ticked), auto or ask. */
    @Field(() => String)
    @IsIn(["off", "auto", "ask"])
    mode!: "off" | "auto" | "ask"
}
