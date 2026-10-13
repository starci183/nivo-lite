import { Field, InputType } from "@nestjs/graphql"
import { IsString, MaxLength, MinLength } from "class-validator"

@InputType()
/** The bounded arguments of startZaloConnection. */
export class StartZaloConnectionInput {
    /** The name. */
    @Field(() => String)
    @IsString()
    @MinLength(1)
    @MaxLength(120)
    name!: string

    /** The Zalo app id. */
    @Field(() => String)
    @IsString()
    @MaxLength(40)
    appId!: string

    /** The Zalo app secret. */
    @Field(() => String)
    @IsString()
    @MaxLength(200)
    appSecret!: string
}
