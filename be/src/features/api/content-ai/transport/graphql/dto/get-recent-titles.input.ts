import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** Identifies the post omitted from the recent-title list. */
export class GetRecentTitlesInput {
    /** The content item id. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    id!: string
}
