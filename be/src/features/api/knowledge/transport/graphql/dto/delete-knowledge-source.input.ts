import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** Which document to delete. */
export class DeleteKnowledgeSourceInput {
    /** The id. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    id!: string
}
