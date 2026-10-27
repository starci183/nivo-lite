import { NullAsAbsent } from "@modules/platform/graphql"
import { Field, ID, InputType } from "@nestjs/graphql"
import { IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from "class-validator"

/** Blank, or 6 to 20 digits once spaces are removed. */
const ACCOUNT_NUMBER = /^\s*(?:(?:\d\s*){6,20})?$/u

@InputType()
/** The bounded arguments of updateMoneyConnection. */
export class UpdateMoneyConnectionInput {
    /** The connection. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(64)
    connectionId!: string

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

    /** The bank code. */
    @Field(() => String)
    @IsString()
    @MaxLength(40)
    bankCode!: string

    /** A new full account number, 6 to 20 digits; blank keeps the stored one. */
    @Field(() => String)
    @IsString()
    @MaxLength(60)
    @Matches(ACCOUNT_NUMBER)
    accountNumber!: string

    /** The account holder. */
    @Field(() => String)
    @IsString()
    @MaxLength(160)
    holder!: string

    /** SePay: the API key. */
    @Field(() => String, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsString()
    @MaxLength(200)
    apiKey?: string
}
