import { Field, ID, InputType } from "@nestjs/graphql"
import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator"

@InputType()
/** Binds the agent that decides on a connected account's trigger, or unbinds it. */
export class BindProviderTriggerDeciderInput {
    /** The connected account. */
    @Field(() => ID)
    @IsString()
    @MaxLength(36)
    @IsUUID()
    connectionId!: string

    /** The trigger name inside the provider (`transaction.received`). */
    @Field(() => String)
    @IsString()
    @MinLength(1)
    @MaxLength(64)
    trigger!: string

    /** The agent to bind; null or absent unbinds. */
    @Field(() => ID, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(36)
    @IsUUID()
    agentId?: string | null
}
