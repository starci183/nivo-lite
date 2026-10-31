import { Field, InputType } from "@nestjs/graphql"
import { IsString, IsUUID, MaxLength } from "class-validator"

@InputType()
/** What listAgentGraphVersions takes. */
export class ListAgentGraphVersionsInput {
    /** The agent. */
    @Field(() => String)
    @IsString()
    @MaxLength(36)
    @IsUUID()
    agentId!: string
}
