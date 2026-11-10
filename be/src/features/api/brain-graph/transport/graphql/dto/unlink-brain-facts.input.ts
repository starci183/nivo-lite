import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** The edge to remove. */
export class UnlinkBrainFactsInput {
    /** The edge id. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    id!: string
}
