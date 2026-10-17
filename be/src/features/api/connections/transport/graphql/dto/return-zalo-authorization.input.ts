import { NullAsAbsent } from "@modules/platform/graphql"
import { Field, InputType } from "@nestjs/graphql"
import { IsOptional, IsString, MaxLength, MinLength } from "class-validator"

@InputType()
/** The bounded arguments of returnZaloAuthorization. */
export class ReturnZaloAuthorizationInput {
    /** The state the authorization started with. */
    @Field(() => String)
    @IsString()
    @MinLength(1)
    @MaxLength(300)
    state!: string

    /** The authorization code. */
    @Field(() => String)
    @IsString()
    @MinLength(1)
    @MaxLength(2048)
    code!: string

    /** The OA id Zalo reports. */
    @Field(() => String, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsString()
    @MaxLength(60)
    oaId?: string
}
