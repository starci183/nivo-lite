import { Field, ID, InputType, Int } from "@nestjs/graphql"
import { IsInt, IsUUID, Max, MaxLength, Min } from "class-validator"

@InputType()
/** Saves the longest a customer waits before the app answers directly. */
export class SaveReplyTimeoutInput {
    /** The installation. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    installationId!: string

    /** Seconds, 5 to 120. */
    @Field(() => Int)
    @IsInt()
    @Min(5)
    @Max(120)
    value!: number
}
