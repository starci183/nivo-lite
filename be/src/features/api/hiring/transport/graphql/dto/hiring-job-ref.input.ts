import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** Names one job of the caller's workspace. */
export class HiringJobRefInput {
    /** The job. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    jobId!: string
}
