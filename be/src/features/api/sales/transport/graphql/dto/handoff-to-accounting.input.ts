import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** The failed Sales item selected by the caller. */
export class HandoffToAccountingInput {
    /** The work item id. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    id!: string
}
