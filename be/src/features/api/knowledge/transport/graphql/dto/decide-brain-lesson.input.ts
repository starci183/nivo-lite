import { Field, ID, InputType } from "@nestjs/graphql"
import { IsIn, IsUUID, MaxLength } from "class-validator"

@InputType()
/** Which lesson and what is decided about it. */
export class DecideBrainLessonInput {
    /** The id. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    id!: string

    /** `active` or `rejected` for a proposal; `retired` for a lesson in force. */
    @Field(() => String)
    @IsIn(["active", "rejected", "retired"])
    @MaxLength(40)
    action!: "active" | "rejected" | "retired"
}
