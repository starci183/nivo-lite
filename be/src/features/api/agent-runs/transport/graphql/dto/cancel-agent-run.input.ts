import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** The bounded arguments of cancelAgentRun. */
export class CancelAgentRunInput {
    /** The run to stop. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(64)
    runId!: string
}
