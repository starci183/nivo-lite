import { NullAsAbsent } from "@modules/platform/graphql"
import { Field, ID, InputType } from "@nestjs/graphql"
import { IsOptional, IsUUID, MaxLength } from "class-validator"

@InputType()
/** Gives a work item to a staff member, or takes the assignment back. */
export class AssignWorkItemInput {
    /** The work item. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    workItemId!: string

    /** The staff member, or null to take the assignment back. */
    @Field(() => ID, { nullable: true })
    @IsOptional()
    @NullAsAbsent()
    @IsUUID("4")
    @MaxLength(36)
    staffId?: string
}
