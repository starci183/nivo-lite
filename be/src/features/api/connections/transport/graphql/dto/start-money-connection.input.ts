import { Field, InputType } from "@nestjs/graphql"
import { IsString, MaxLength, MinLength } from "class-validator"

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

    /** The account number (bank feeds). */
    @Field(() => String)
    @IsString()
    @MaxLength(60)
    accountNumber!: string

    /** The account holder (bank feeds). */
    @Field(() => String)
    @IsString()
    @MaxLength(160)
    holder!: string
}
