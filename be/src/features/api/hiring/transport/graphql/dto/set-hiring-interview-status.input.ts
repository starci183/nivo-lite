import { Field, ID, InputType } from "@nestjs/graphql"
import { IsIn, IsUUID, MaxLength } from "class-validator"

@InputType()
/** The bounded arguments that mark an interview done, cancelled or missed. */
export class SetHiringInterviewStatusInput {
    /** The interview. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    id!: string

    /** The new status. */
    @Field(() => String)
    @IsIn(["done", "cancelled", "no_show"])
    status!: "done" | "cancelled" | "no_show"
}
