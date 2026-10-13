import { Field, InputType, ID } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** Bounded arguments for mark booking no show. */
export class MarkBookingNoShowInput {
    /** The id. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    id!: string
}
