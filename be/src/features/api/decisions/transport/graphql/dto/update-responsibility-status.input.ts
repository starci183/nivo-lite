import { Field, ID, InputType } from "@nestjs/graphql"
import { IsIn, IsUUID, MaxLength } from "class-validator"

@InputType()
/** Moves a responsibility to a status. */
export class UpdateResponsibilityStatusInput {
    /** The responsibility. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    responsibilityId!: string

    /** The status to move it to. */
    @Field()
    @IsIn(["open", "waiting_approval", "done"])
    status!: "open" | "waiting_approval" | "done"
}
