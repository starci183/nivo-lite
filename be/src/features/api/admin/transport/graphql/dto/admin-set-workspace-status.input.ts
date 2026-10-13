import { Field, ID, InputType } from "@nestjs/graphql"
import { IsIn, IsUUID, MaxLength } from "class-validator"
import type { SupportStatus } from "@modules/domain/workspaces"

@InputType()
/** The bounded arguments that set the billing status. */
export class AdminSetWorkspaceStatusInput {
    /** The workspace. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    workspaceId!: string

    /** The billing status to set: active or past_due. */
    @Field()
    @IsIn(["active", "past_due"])
    status!: SupportStatus
}
