import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** What agentGraphLayout takes. */
export class AgentGraphLayoutInput {
    /** The installation whose Graph page is laid out. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    installationId!: string
}
