import { Field, InputType, ID } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** Bounded arguments for remove booking exception. */
export class RemoveBookingExceptionInput {
    /** The id. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    id!: string
}
