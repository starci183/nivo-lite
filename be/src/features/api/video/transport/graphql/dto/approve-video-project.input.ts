import { InputType, Field, ID } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** Bounded approveVideoProject arguments. */
export class ApproveVideoProjectInput {
    /** Project in the checked workspace. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    projectId!: string
}
