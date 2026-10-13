import { Field, ID, InputType } from "@nestjs/graphql"
import { IsIn, IsUUID, MaxLength } from "class-validator"

@InputType()
/** The bounded arguments that put a purchase order before the owner to send. */
export class RequestInventorySendInput {
    /** The purchase order. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    poId!: string

    /** Whether to send the order or remind the supplier. */
    @Field(() => String)
    @IsIn(["order", "reminder"])
    kind!: "order" | "reminder"
}
