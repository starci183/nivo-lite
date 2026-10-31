import { Field, InputType } from "@nestjs/graphql"
import { IsString, IsUUID, MaxLength } from "class-validator"

@InputType()
/** What publishAgentGraph takes. */
export class PublishAgentGraphInput {
    /** The agent. */
    @Field(() => String)
    @IsString()
    @MaxLength(36)
    @IsUUID()
    agentId!: string

    /** What the change was for. */
    @Field(() => String)
    @IsString()
    @MaxLength(500)
    note!: string
}
