import { Field, InputType, ID } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** Bounded arguments for paymentOrder. */
export class PaymentOrderInput {
    /** The id selector. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    @MaxLength(36)
    id!: string
}
