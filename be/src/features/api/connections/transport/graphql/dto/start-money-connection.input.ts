import { Field, InputType } from "@nestjs/graphql"
import { IsString, Matches, MaxLength, MinLength } from "class-validator"

/** Blank, or 6 to 20 digits once spaces are removed. */
const ACCOUNT_NUMBER = /^\s*(?:(?:\d\s*){6,20})?$/u

@InputType()
/** The bounded arguments of startMoneyConnection. */
export class StartMoneyConnectionInput {
    /** Which feed: sepay, payos or casso. */
    @Field(() => String)
    @IsString()
    @MaxLength(20)
    provider!: string

    /** Test or live. */
    @Field(() => String)
    @IsString()
    @MaxLength(10)
    environment!: string

    /** The name. */
    @Field(() => String)
    @IsString()
    @MinLength(1)
    @MaxLength(120)
    name!: string

    /** The bank code (bank feeds). */
    @Field(() => String)
    @IsString()
    @MaxLength(40)
    bankCode!: string

    /** The full account number, 6 to 20 digits (required by bank feeds; blank for payOS). */
    @Field(() => String)
    @IsString()
    @MaxLength(60)
    @Matches(ACCOUNT_NUMBER)
    accountNumber!: string

    /** The account holder (bank feeds). */
    @Field(() => String)
    @IsString()
    @MaxLength(160)
    holder!: string
}
