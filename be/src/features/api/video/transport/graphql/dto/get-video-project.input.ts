import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** Bounded videoProject arguments. */
export class GetVideoProjectInput {
    /** projectId input. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    projectId!: string
}
