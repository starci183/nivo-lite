import { Field, ID, InputType } from "@nestjs/graphql"
import { IsString, IsUUID, MaxLength, MinLength } from "class-validator"

@InputType()
/** Renames an agent. */
export class RenameAgentInput {
    /** The agent. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    agentId!: string

    /** The new display name. */
    @Field()
    @IsString()
    @MinLength(1)
    @MaxLength(120)
    name!: string
}
