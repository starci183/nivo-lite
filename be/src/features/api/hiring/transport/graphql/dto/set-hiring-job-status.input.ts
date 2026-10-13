import { Field, ID, InputType } from "@nestjs/graphql"
import { IsIn, IsUUID, MaxLength } from "class-validator"

@InputType()
/** The bounded arguments that open, pause or close a job. */
export class SetHiringJobStatusInput {
    /** The job. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    id!: string

    /** The new status. */
    @Field(() => String)
    @IsIn(["draft", "open", "paused", "closed"])
    status!: "draft" | "open" | "paused" | "closed"
}
