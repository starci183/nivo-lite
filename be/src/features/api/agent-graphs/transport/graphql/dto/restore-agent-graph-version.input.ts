import { Field, InputType } from "@nestjs/graphql"
import { IsString, IsUUID, MaxLength } from "class-validator"

@InputType()
/** What restoreAgentGraphVersion takes. */
export class RestoreAgentGraphVersionInput {
    /** The agent. */
    @Field(() => String)
    @IsString()
    @MaxLength(36)
    @IsUUID()
    agentId!: string

    /** The version to go back to. */
    @Field(() => String)
    @IsString()
    @MaxLength(36)
    @IsUUID()
    versionId!: string
}
