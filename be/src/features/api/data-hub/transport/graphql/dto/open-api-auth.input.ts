import { Field, InputType } from "@nestjs/graphql"
import { IsString, MaxLength } from "class-validator"

@InputType()
/** The credential of an API connection as typed in the wizard; a blank secret keeps the stored one when the type is unchanged. */
export class OpenApiAuthInput {
    /** The authentication type: none, header, query, bearer or basic. */
    @Field(() => String)
    @IsString()
    @MaxLength(20)
    type!: string

    /** The header or query parameter name of an API key. */
    @Field(() => String)
    @IsString()
    @MaxLength(100)
    name!: string

    /** The API key or token. */
    @Field(() => String)
    @IsString()
    @MaxLength(4000)
    value!: string

    /** The basic-auth user. */
    @Field(() => String)
    @IsString()
    @MaxLength(500)
    user!: string

    /** The basic-auth password. */
    @Field(() => String)
    @IsString()
    @MaxLength(500)
    password!: string
}
