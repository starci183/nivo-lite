import { Field, ID, InputType } from "@nestjs/graphql"
import { IsString, IsUUID, MaxLength } from "class-validator"

@InputType()
/** The bounded arguments of saveZaloOaSecret. */
export class SaveZaloOaSecretInput {
    /** The connection. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(64)
    connectionId!: string

    /** The OA Secret Key. */
    @Field(() => String)
    @IsString()
    @MaxLength(200)
    oaSecret!: string
}
