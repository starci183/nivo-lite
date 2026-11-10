import { Field, ID, InputType } from "@nestjs/graphql"
import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator"
import { STOP_ACTIONS } from "@modules/domain/agent-threads/stops"

@InputType()
/** The bounded arguments of decideRunStop. */
export class DecideRunStopInput {
    /** The run (the thread) that waits at a stop. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(64)
    runId!: string

    /** The step whose stop is answered; absent answers the run's open stop. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MinLength(1)
    @MaxLength(200)
    stepKey?: string | null

    /** `answer` (with text), `retry`, `take_over` or `skip`. */
    @Field(() => String)
    @IsIn([...STOP_ACTIONS])
    action!: string

    /** The founder's words, for `answer`. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(4000)
    text?: string | null
}
