import { ArgsType, Field, ID } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@ArgsType()
/** Names the work item of a reconciliation. */
export class ReconcileDetailsArgs {
    /** The work item. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    workItemId!: string
}
