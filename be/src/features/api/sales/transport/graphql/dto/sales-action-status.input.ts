import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** The Sales action selected for polling. */
export class SalesActionStatusInput {
    /** The queued Sales work item id. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    id!: string
}
