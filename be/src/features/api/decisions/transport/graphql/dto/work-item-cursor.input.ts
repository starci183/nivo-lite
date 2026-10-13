import { Field, ID, InputType } from "@nestjs/graphql"
import { IsString, IsUUID, MaxLength } from "class-validator"

@InputType()
/** The position after which a page of work items starts. */
export class WorkItemCursorInput {
    /** The `created_at` of the last item of the previous page. */
    @Field()
    @IsString()
    @MaxLength(40)
    createdAt!: string

    /** The id of the last item of the previous page. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    id!: string
}
