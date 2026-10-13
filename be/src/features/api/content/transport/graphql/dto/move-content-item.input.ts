import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID, IsISO8601, MaxLength } from "class-validator"

@InputType()
/** Calendar drag arguments. */
export class MoveContentItemInput {
    /** The id field. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    id!: string
    /** The scheduledAt field. */
    @Field()
    @IsISO8601()
    @MaxLength(40)
    scheduledAt!: string
}
