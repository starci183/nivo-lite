import { Field, ID, InputType } from "@nestjs/graphql"
import { IsString, IsUUID, MaxLength } from "class-validator"

@InputType()
/** The bounded arguments of saveZnsRenewal. */
export class SaveZnsRenewalInput {
    /** The Zalo connection. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(64)
    connectionId!: string

    /** The approved ZNS template id; empty turns the fallback off. */
    @Field(() => String)
    @IsString()
    @MaxLength(20)
    templateId!: string

    /** The template parameter of the customer name. */
    @Field(() => String)
    @IsString()
    @MaxLength(50)
    customerName!: string

    /** The template parameter of the plan. */
    @Field(() => String)
    @IsString()
    @MaxLength(50)
    plan!: string

    /** The template parameter of the end date of the term. */
    @Field(() => String)
    @IsString()
    @MaxLength(50)
    endDate!: string

    /** The template parameter of the amount. */
    @Field(() => String)
    @IsString()
    @MaxLength(50)
    amount!: string

    /** The template parameter of the transfer content. */
    @Field(() => String)
    @IsString()
    @MaxLength(50)
    transferContent!: string

    /** The template parameter of the invoice number. */
    @Field(() => String)
    @IsString()
    @MaxLength(50)
    invoiceNumber!: string
}
