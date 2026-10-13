import { Field, ID, InputType } from "@nestjs/graphql"
import { Transform } from "class-transformer"
import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator"

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

    /** A new account number; blank keeps the stored one. */
    @Field(() => String)
    @IsString()
    @MaxLength(60)
    accountNumber!: string

    /** The account holder. */
    @Field(() => String)
    @IsString()
    @MaxLength(160)
    holder!: string

    /** SePay: the API key. */
    @Field(() => String, { nullable: true })
    @Transform(({ value }) => value ?? undefined)
    @IsOptional()
    @IsString()
    @MaxLength(200)
    apiKey?: string
}
