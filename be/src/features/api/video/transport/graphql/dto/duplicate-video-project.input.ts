import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** Bounded duplicateVideoProject arguments. */
export class DuplicateVideoProjectInput {
    /** projectId input. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    projectId!: string
}
