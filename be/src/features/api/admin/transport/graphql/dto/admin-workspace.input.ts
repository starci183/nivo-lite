import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** The workspace one console read is about. */
export class AdminWorkspaceInput {
    /** The workspace. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    workspaceId!: string
}
