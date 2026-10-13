import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** Which question to dismiss. */
export class DismissKnowledgeGapInput {
    /** The id. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    id!: string
}
