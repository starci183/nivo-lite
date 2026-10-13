import { Field, InputType, ID } from "@nestjs/graphql"
import { ArrayMaxSize, ArrayUnique, IsArray, IsUUID } from "class-validator"

@InputType()
/** Bounded arguments for billingReviewTransactions. */
export class BillingReviewTransactionsInput {
    /** The orderIds selector. */
    @Field(() => [ID])
    @IsArray()
    @ArrayMaxSize(50)
    @ArrayUnique()
    @IsUUID("all", { each: true })
    orderIds!: Array<string>
}
