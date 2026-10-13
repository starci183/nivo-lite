import { Field, InputType } from "@nestjs/graphql"
import { IsIn, IsString, MaxLength } from "class-validator"

@InputType()
/** One line of the prompt of a generation. */
export class AgentGenMessageInput {
    /** Who speaks the line. */
    @Field()
    @IsIn(["system", "user", "assistant"])
    role!: "system" | "user" | "assistant"

    /** The text of the line. */
    @Field()
    @IsString()
    @MaxLength(60000)
    content!: string
}
