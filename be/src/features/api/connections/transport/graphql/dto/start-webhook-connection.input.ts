import { Field, InputType } from "@nestjs/graphql"
import { ArrayMaxSize, IsArray, IsString, MaxLength, MinLength } from "class-validator"

@InputType()
/** The bounded arguments of startWebhookConnection. */
export class StartWebhookConnectionInput {
    /** The name. */
    @Field(() => String)
    @IsString()
    @MinLength(1)
    @MaxLength(120)
    name!: string

    /** The receiver address. */
    @Field(() => String)
    @IsString()
    @MaxLength(2048)
    url!: string

    /** The picked events. */
    @Field(() => [String])
    @IsArray()
    @ArrayMaxSize(20)
    @IsString({ each: true })
    @MaxLength(40, { each: true })
    events!: ReadonlyArray<string>
}
