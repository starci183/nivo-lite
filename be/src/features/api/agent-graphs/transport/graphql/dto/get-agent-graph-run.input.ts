import { Field, InputType } from "@nestjs/graphql"
import { IsString, IsUUID, MaxLength } from "class-validator"

@InputType()
/** What agentGraphRun takes. */
export class GetAgentGraphRunInput {
    /** The work item. */
    @Field(() => String)
    @IsString()
    @MaxLength(36)
    @IsUUID()
    workItemId!: string
}
