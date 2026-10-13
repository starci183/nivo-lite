import { Field, InputType } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** Bounded arguments for drafting the selected responsibility's execution. */
export class DraftLeadExecutionInput {
    /** The workspace-scoped responsibility selected for the draft. */
    @Field()
    @IsUUID()
    @MaxLength(36)
    responsibilityId!: string
}
