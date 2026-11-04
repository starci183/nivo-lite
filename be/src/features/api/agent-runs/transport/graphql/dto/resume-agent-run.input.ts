import { Field, ID, InputType } from "@nestjs/graphql"
import { IsString, IsUUID, MaxLength, MinLength } from "class-validator"

@InputType()
/** The bounded arguments of resumeAgentRun. */
export class ResumeAgentRunInput {
    /** The parked run. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(64)
    runId!: string

    /** Why it runs again, in a few words; kept on the run. */
    @Field(() => String)
    @IsString()
    @MinLength(1)
    @MaxLength(500)
    reason!: string
}
