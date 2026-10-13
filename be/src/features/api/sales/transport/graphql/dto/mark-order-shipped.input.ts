import { Field, ID, InputType } from "@nestjs/graphql"
import { IsString, IsUUID, MaxLength, MinLength } from "class-validator"

@InputType()
/** The bounded order shipment details. */
export class MarkOrderShippedInput {
    /** The order id. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    orderId!: string

    /** The carrier responsible for delivery. */
    @Field()
    @IsString()
    @MinLength(1)
    @MaxLength(80)
    carrier!: string

    /** The carrier's tracking code. */
    @Field()
    @IsString()
    @MinLength(1)
    @MaxLength(80)
    trackingCode!: string
}
