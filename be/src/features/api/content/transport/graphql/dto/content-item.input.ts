import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** Identifies one content item within the selected workspace. */
export class ContentItemInput {
    /** The content item id. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    id!: string
}
