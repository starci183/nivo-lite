import { Field, ID, InputType } from "@nestjs/graphql"
import { IsString, IsUUID, MaxLength, MinLength } from "class-validator"

@InputType()
/** Hands an agent work. */
export class AssignAgentWorkInput {
    /** The agent. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    agentId!: string

    /** What to do, as the person wrote it. */
    @Field()
    @IsString()
    @MinLength(1)
    @MaxLength(4000)
    text!: string
}
