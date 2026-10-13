import { ArgsType, Field, ID } from "@nestjs/graphql"
import { IsOptional, IsUUID, MaxLength } from "class-validator"

@ArgsType()
/** Gives a work item to a staff member, or takes it back. */
export class AssignWorkItemArgs {
    /** The work item. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    workItemId!: string

    /** The staff member; absent takes the item back. */
    @Field(() => ID, { nullable: true })
    @IsOptional()
    @IsUUID("4")
    @MaxLength(36)
    staffId?: string | null
}
