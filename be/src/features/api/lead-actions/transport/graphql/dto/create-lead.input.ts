import { Field, InputType } from "@nestjs/graphql"
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from "class-validator"

@InputType()
/** Bounded arguments for the create-lead mutation. */
export class CreateLeadInput {
    /** The customer's name. */
    @Field()
    @IsString()
    @MinLength(2)
    @MaxLength(200)
    contactName!: string

    /** The customer's company. */
    @Field()
    @IsString()
    @MinLength(2)
    @MaxLength(200)
    company!: string

    /** The source channel of the lead. */
    @Field()
    @IsString()
    @MinLength(1)
    @MaxLength(100)
    channel!: string

    /** The customer's stated need. */
    @Field()
    @IsString()
    @MinLength(5)
    @MaxLength(2000)
    need!: string

    /** The customer's phone number. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(80)
    phone?: string | null

    /** The customer's email address. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsEmail()
    @MaxLength(320)
    email?: string | null
}
