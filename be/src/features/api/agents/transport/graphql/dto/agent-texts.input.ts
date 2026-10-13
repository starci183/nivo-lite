import { Field, InputType } from "@nestjs/graphql"
import { IsString, MaxLength } from "class-validator"

@InputType()
/** The free texts of an agent. */
export class AgentTextsInput {
    /** The instructions. */
    @Field()
    @IsString()
    @MaxLength(20000)
    instructions!: string

    /** The business notes. */
    @Field()
    @IsString()
    @MaxLength(50000)
    knowledge!: string
}
