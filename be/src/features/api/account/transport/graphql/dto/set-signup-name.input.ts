import { Field, InputType } from "@nestjs/graphql"
import { IsEmail, IsString, MaxLength, MinLength } from "class-validator"

@InputType()
/** The address of the new account and the full name typed beside it. */
export class SetSignupNameInput {
    /** The address the account was created with. */
    @Field()
    @IsEmail()
    @MaxLength(254)
    email!: string

    /** The full name. */
    @Field()
    @IsString()
    @MinLength(1)
    @MaxLength(120)
    name!: string
}
